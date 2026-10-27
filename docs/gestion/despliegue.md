# Despliegue en producción

`acceso.agrocom.com.bo` corre en el CT 120 (`acceso`, Ubuntu 24.04) de Proxmox. Decisión en el ADR 0014.

```
internet ─ NPMplus (CT 107, 192.168.100.249, TLS Let's Encrypt)
              └─ acceso.agrocom.com.bo ─▶ CT 120 :80    panel (React, super admin) ─ /api ─▶ api :3000 ─▶ MariaDB 10.11 compartida (por IP)
                                                          └─ /app/ ─▶ app (Flutter web, sin puerto publicado) ─ /api ─▶ api
```

Un solo subdominio y un solo certificado: el panel ocupa la raíz (`/ingreso`) y la app de usuarios vive en `https://acceso.agrocom.com.bo/app/` (se compila con `--base-href /app/`). El Nginx del panel reenvía `/app/` al contenedor `app`, así que NPMplus sigue con una sola regla hacia el puerto 80. Las dos comparten `/api` y no se pisan el almacenamiento del navegador (claves distintas).

- **Red:** el CT 120 solo tiene IP privada (`192.168.100.236`, debe ser fija o reservada). Nada del CT se publica a internet sin pasar por NPMplus.
- **Base de datos:** la MariaDB 10.11 compartida (otro servidor, alcanzada por IP desde el CT 120; ADR 0034). No hay contenedor de base en este compose. Base `acceso` y usuario `acceso` propios, sin `root`; `DB_HOST` y `DB_PORT` van en `/opt/acceso/.env`.
- **Secretos:** `/opt/acceso/.env` en el CT (plantilla: `docs/gestion/produccion-variables.ejemplo`). Nunca en el repo.
- **Runner:** servicio `actions.runner.Agrocom-SRL-Qr-access.acceso-120` (usuario `runner`, etiqueta `acceso-prod`).

## IP del cliente y `TRUST_PROXY`

La API saca la IP del cliente de `X-Forwarded-For` para el rate limit y los bloqueos por IP (ADR 0030 §3.2). `TRUST_PROXY` es un **número de saltos** (por omisión `1`) o una lista de IP/CIDR; nunca `true`, que la API rechaza al arrancar: confiaría en cualquier cabecera y quien la falsee elegiría su propia IP, evadiendo o agotando el límite de otro.

Con `TRUST_PROXY=1` la API toma como cliente la **última** dirección de `X-Forwarded-For` (la que añadió el proxy inmediato). Por eso el Nginx que reenvía a la API debe **sobrescribir** la cabecera con la IP real, no añadirle:

```
proxy_set_header X-Forwarded-For $remote_addr;   # nunca $proxy_add_x_forwarded_for
```

En la cadena actual (NPMplus → Nginx del panel → Nginx de `app` → API) el Nginx del panel y el de `app` recuperan al cliente con `set_real_ip_from` + `real_ip_header X-Forwarded-For` (rangos privados: solo ellos pueden llegar ahí) y lo sobrescriben hacia el siguiente salto (`web/nginx.conf`, `app/nginx.conf`). NPMplus añade la IP del cliente con su comportamiento normal. Si cambias la cadena (otro proxy, otro salto), ajusta `set_real_ip_from` y `TRUST_PROXY` juntos; después comprueba que una petición con un `X-Forwarded-For` falseado no cambia la IP que la API registra para ti. Si la API quedara expuesta sin proxy, usa `TRUST_PROXY=0`.

## Flujo

1. `git tag -a vX.Y.Z` sobre `develop` y `git push origin vX.Y.Z`.
2. `release.yml`: CI completa, merge a `master` (deploy key con bypass) y GitHub Release.
3. El push a `master` dispara `deploy.yml` en el runner del CT, que corre `bin/desplegar`.
4. `bin/desplegar` es idempotente: migra, siembra el catálogo, crea `root` solo si no existe y espera a `/api/v1/salud`.

## Primer arranque

El `.env` se crea una vez en el CT (secretos aleatorios, `ADMIN_INICIAL_CLAVE` solo para el primer ingreso):

```
install -d -o runner -g runner -m 750 /opt/acceso
cat > /opt/acceso/.env <<EOF
DB_HOST=<IP de la MariaDB compartida>
DB_PORT=3306
MYSQL_DATABASE=acceso
MYSQL_USER=acceso
MYSQL_PASSWORD=<la clave del usuario `acceso` en el servidor de base de datos>
JWT_SECRETO=$(openssl rand -hex 32)
PIN_PIMIENTA=$(openssl rand -base64 32)
ADMIN_INICIAL_CLAVE=<contraseña temporal>
EOF
chown runner:runner /opt/acceso/.env && chmod 600 /opt/acceso/.env
```

`root` nace con contraseña temporal: el panel obliga a cambiarla en el primer ingreso. Después, borra `ADMIN_INICIAL_CLAVE` del `.env`.

## Ver los datos (phpMyAdmin)

No arranca solo. En el CT, desde un checkout del repo:

```
docker compose -p acceso --env-file /opt/acceso/.env -f docker-compose.prod.yml --profile herramientas up -d phpmyadmin
```

Escucha en `:8082` de la red privada. Para abrirlo por web, un sitio en NPMplus con HTTPS y Access List; no se expone sin autenticación delante.

## Migraciones sobre `eventos_acceso` poblada

`eventos_acceso` recibe una fila por cada lectura de cada placa, así que una migración que la bloquee corta los registros. Regla: sobre esta tabla, cada `ALTER` va con `ALGORITHM=INPLACE, LOCK=NONE` (si MariaDB no puede cumplirlo, falla en vez de bloquear). Una clave foránea nueva exige `SET foreign_key_checks = 0` en la sesión de la migración (MariaDB 10.11 responde `ERROR 1846: Adding foreign keys needs foreign_key_checks=OFF` y solo ofrece `COPY`); es seguro cuando la columna nace toda en `NULL` y no hay filas que validar.

La migración `20261028100001` (`repetido_de_id`, ADR 0032) va en tres `ALTER`: columna, índices y clave foránea. Verificada en MariaDB 10.11.14 con una base nueva y la tabla con 200 000 filas, con un escritor insertando en paralelo (400 inserciones, una cada ~50 ms):

- subir: 2,1 s en total (incluye el arranque del cliente), sin un solo error de escritura; la inserción más lenta del escritor concurrente tardó 429 ms, que es el arranque del cliente `mysql`, no un bloqueo;
- bajar y volver a subir: correcto, con las 200 400 filas intactas;
- el `ALTER` único original (columna + índice + FK) con `LOCK=NONE` falla con el error 1846, por eso se partió.

Ventana de despliegue: ninguna; se puede aplicar con la API en marcha. Para tablas mucho mayores, repite la medición en una copia antes de migrar.

## Respaldo

La base vive en el servidor de base de datos compartido, no en el CT 120. Respaldo mínimo, desde el CT: `docker run --rm --env-file /opt/acceso/.env mariadb:10.11 sh -c 'mariadb-dump -h"$DB_HOST" -P"$DB_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --single-transaction "$MYSQL_DATABASE"' | gzip > acceso-$(date +%F).sql.gz`, más el respaldo propio de ese servidor. Nunca `DROP DATABASE` sobre `acceso`.

## Conectar la base compartida (una sola vez)

1. Desde phpMyAdmin del servidor (como administrador), crea la base y un usuario solo para esta aplicación, limitado a la IP del CT 120:
   ```
   CREATE DATABASE acceso CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'acceso'@'<IP del CT 120>' IDENTIFIED BY '<clave>';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON acceso.* TO 'acceso'@'<IP del CT 120>';
   ```
2. Pon `DB_HOST`, `DB_PORT`, `MYSQL_DATABASE`, `MYSQL_USER` y `MYSQL_PASSWORD` en `/opt/acceso/.env`.
3. Comprueba la conexión desde el CT: `docker run --rm mariadb:10.11 mariadb -h <DB_HOST> -u acceso -p -e 'SELECT @@version'`.
4. Despliega (tag). `bin/desplegar` migra con dbmate, siembra el catálogo y crea `root` si falta.

El servidor ya escucha en `0.0.0.0`; el puerto 3306 solo debe estar abierto para la IP del CT 120.

Si había datos en la base MySQL vieja del contenedor `acceso_datos-db`, se vuelcan con `mysqldump --no-create-info --complete-insert` y se restauran sobre la base ya migrada antes de abrir al público; ese volumen no se borra hasta confirmar el uso estable.
