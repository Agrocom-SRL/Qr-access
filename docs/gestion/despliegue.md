# Despliegue en producción

`acceso.agrocom.com.bo` corre en el CT 120 (`acceso`, Ubuntu 24.04) de Proxmox. Decisión en el ADR 0014.

```
internet ─ NPMplus (CT 107, 192.168.100.249, TLS Let's Encrypt)
              └─ acceso.agrocom.com.bo ─▶ CT 120 :80    panel (React, super admin) ─ /api ─▶ api :3000 ─▶ db (MariaDB 11.8)
                                                          └─ /app/ ─▶ app (Flutter web, sin puerto publicado) ─ /api ─▶ api
```

Un solo subdominio y un solo certificado: el panel ocupa la raíz (`/ingreso`) y la app de usuarios vive en `https://acceso.agrocom.com.bo/app/` (se compila con `--base-href /app/`). El Nginx del panel reenvía `/app/` al contenedor `app`, así que NPMplus sigue con una sola regla hacia el puerto 80. Las dos comparten `/api` y no se pisan el almacenamiento del navegador (claves distintas).

- **Red:** el CT 120 solo tiene IP privada (`192.168.100.236`, debe ser fija o reservada). Nada del CT se publica a internet sin pasar por NPMplus.
- **Base de datos:** MariaDB 11.8 en contenedor, volumen `datos-mariadb`, sin puerto publicado (ADR 0034). La MariaDB compartida del CT 108 sigue siendo otra instancia: esta plataforma usa la suya, con su propia contraseña de `root`.
- **Secretos:** `/opt/acceso/.env` en el CT (plantilla: `docs/gestion/produccion-variables.ejemplo`). Nunca en el repo.
- **Runner:** servicio `actions.runner.Agrocom-SRL-Qr-access.acceso-120` (usuario `runner`, etiqueta `acceso-prod`).

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
MYSQL_DATABASE=acceso
MYSQL_USER=acceso
MYSQL_PASSWORD=$(openssl rand -hex 24)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
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

## Respaldo

La base vive en el volumen `datos-mariadb`. Respaldo mínimo: `docker compose -p acceso exec -T db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction acceso' | gzip > acceso-$(date +%F).sql.gz`, más el snapshot del CT en Proxmox. Nunca `docker compose down -v` ni `docker volume rm` sobre `acceso_datos-mariadb`.

## Pasar de MySQL 8.4 a MariaDB 11.8 (una sola vez, ADR 0034)

El volumen `acceso_datos-db` guarda archivos de MySQL, que MariaDB no abre. Por eso el volumen nuevo es `acceso_datos-mariadb` y los datos pasan por un volcado. Solo los datos: el esquema lo crea dbmate con las migraciones ya compatibles. El volcado y la restauración se probaron con la base de desarrollo en un contenedor descartable (mismos conteos).

1. **Antes del tag**, con la versión vieja todavía en marcha, en el CT 120:
   ```
   docker compose -p acceso exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --no-create-info --skip-triggers --complete-insert --single-transaction --default-character-set=utf8mb4 --ignore-table=acceso.schema_migrations acceso' > /opt/acceso/datos-mysql.sql
   docker compose -p acceso exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction acceso' | gzip > acceso-completo-$(date +%F).sql.gz
   ```
   El segundo archivo es el respaldo completo; guárdalo fuera del CT. Anota también el conteo de filas de `usuarios`, `cuentas`, `qr_accesos` y `eventos_acceso`.
2. **Despliega la versión nueva** (tag). `bin/desplegar` levanta la MariaDB vacía, migra, siembra el catálogo y crea el `root` si falta.
3. **Restaura los datos** sobre la base ya migrada. Si `bin/desplegar` creó un `root` inicial, bórralo antes (es la única fila nueva con conflicto) y detén la API mientras restauras:
   ```
   docker compose -p acceso --env-file /opt/acceso/.env -f docker-compose.prod.yml stop api
   docker compose -p acceso exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --default-character-set=utf8mb4 "$MARIADB_DATABASE"' < /opt/acceso/datos-mysql.sql
   docker compose -p acceso --env-file /opt/acceso/.env -f docker-compose.prod.yml start api
   ```
4. **Comprueba** los conteos anotados y que el panel ingresa con el `root` de siempre.
5. **No borres** `acceso_datos-db` hasta tener una o dos semanas de uso estable: es el respaldo en caliente. Nunca `docker compose down -v` ni `docker volume rm` sobre ese volumen.
