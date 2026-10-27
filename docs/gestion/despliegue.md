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

## Borde: NPMplus, caché y cabeceras (ADR 0033 §2)

Cada capa pone lo suyo, y ninguna repite lo de otra. NPMplus termina TLS y reenvía; el Nginx del CT 120 pone las cabeceras de sus propias respuestas; la API pone las de `/api/`.

| Qué | Dónde | Valor |
|---|---|---|
| HSTS | NPMplus, pestaña SSL del host `acceso.agrocom.com.bo` | Activado con `max-age=31536000`. HSTS es **por host**: `/app/` vive en ese mismo host, así que queda cubierto y no hay que configurar nada aparte para la app (se comprueba en la lista de abajo). Subdominios: **no**, hasta confirmar que todos los de `agrocom.com.bo` sirven HTTPS (decisión pendiente). Preload: no. |
| Caché del borde | NPMplus, el mismo host | «Cache Assets» (o la caché equivalente de NPMplus) **desactivado**, sin excepciones. Una ruta `/api/…/x.js` no puede quedar guardada si el borde cachea por extensión. |
| `/api/` sin caché | API y Nginx del CT | La API responde `Cache-Control: no-store` y `Vary: Authorization`, también en los errores. El Nginx no tiene `proxy_cache`. NPMplus no debe ocultar ni reescribir `Cache-Control` (nada de `proxy_hide_header` ni `add_header` sobre `/api/`). |
| CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` | Nginx del CT: `web/nginx/cabeceras-seguridad.conf` (panel) y `app/nginx/cabeceras-seguridad.conf` (app) | Por respuesta. NPMplus no las añade, para no duplicarlas. Si alguien añade cabeceras en la pestaña Advanced del host, que no repitan estas. El panel permite `img-src 'self' blob:` para la vista previa de QR y comprobantes (un blob local, no sale del origen). |
| Caché del panel | Nginx del CT | Solo `/assets/` (nombres con hash): un año, `immutable`, y solo en respuestas 2xx. El resto, `no-cache`. |
| Respuesta si la API no responde | Nginx del CT (`@api_caida` en `web/nginx.conf` y `app/nginx.conf`) | 503 con problema RFC 9457 (`servicio.no_disponible`), `no-store`, `Vary: Authorization`. Un 503 que emite la propia API pasa tal cual. |
| Límites de borde (`limit_req`, `limit_conn`, tope de cuerpo, timeouts; ADR 0030 §3) | NPMplus | Pendiente (ola W3). Sus valores se documentarán aquí cuando se fijen. |

**Comprobación tras desplegar** (con la versión que incluye W1):

```
# API: no-store y Vary: Authorization, y HSTS del host
curl -sI https://acceso.agrocom.com.bo/api/v1/salud | grep -iE '^(cache-control|vary|strict-transport-security)'
# Un archivo con hash de /assets/, tomado del propio índice (no hace falta escribir su nombre)
RUTA=$(curl -s https://acceso.agrocom.com.bo/ | grep -o '/assets/[^"]*\.js' | head -1)
curl -sI "https://acceso.agrocom.com.bo$RUTA" | grep -iE '^(cache-control|age|x-cache-status)'
#   esperado: solo «cache-control: public, max-age=31536000, immutable»; sin «age» ni «x-cache-status» de NPMplus
# La app comparte host: HSTS también en /app/
curl -sI https://acceso.agrocom.com.bo/app/ | grep -i '^strict-transport-security'
# Una ruta /api/… con extensión .js: sin caché del borde y nunca HTML del panel
curl -sI https://acceso.agrocom.com.bo/api/v1/no-existe.js | grep -iE '^(cache-control|age|x-cache-status|content-type)'
```

**NPMplus no añade cabeceras propias ni recorta `Vary`.** Se compara la lista de nombres de cabecera que llega por el borde con la que sale del CT (directo, por la red privada). Solo puede diferir `strict-transport-security`, que pone NPMplus a propósito; cualquier otra diferencia es una cabecera inyectada o recortada. `vary` debe contener `Authorization` en ambos lados.

```
nombres() { tr -d '\r' | cut -d: -f1 | tr 'A-Z' 'a-z' | sort; }
diff <(curl -sI http://192.168.100.236/api/v1/salud | nombres) <(curl -sI https://acceso.agrocom.com.bo/api/v1/salud | nombres)
curl -sI https://acceso.agrocom.com.bo/api/v1/salud | tr -d '\r' | grep -i '^vary'   # debe incluir Authorization
```

### Checklist de despliegue del borde

Antes de dar por bueno un despliegue, en NPMplus y en el CT 120:

- [ ] **HSTS** activado en el host `acceso.agrocom.com.bo` con `max-age=31536000`, sin subdominios y sin preload; `strict-transport-security` sale en `/`, en `/app/` y en `/api/`.
- [ ] **«Cache Assets» desactivado** en el host `acceso.agrocom.com.bo` de NPMplus, sin excepciones.
- [ ] **Sin `proxy_cache`** en el borde ni en el CT: `grep -n proxy_cache web/nginx.conf app/nginx.conf` no devuelve nada.
- [ ] NPMplus no oculta, reescribe ni añade `Cache-Control` ni `Vary` sobre `/api/` (ni `proxy_hide_header`, ni `add_header` en la pestaña Advanced).
- [ ] La comprobación de nombres de cabecera (arriba) no muestra cabeceras inyectadas por NPMplus.
- [ ] `bin/verificar-nginx panel` y `bin/verificar-nginx app` pasan sobre el build que se despliega.

### Excepciones de la CSP de la app web

La CSP de la app (`app/nginx/cabeceras-seguridad.conf`) es estricta, pero Flutter web 3.47.4 necesita cinco excepciones. Se probaron con Chrome headless y el build real: sin `wasm-unsafe-eval` o sin el CDN de canvaskit la app no pinta; sin el hash o sin `unsafe-inline` en estilos, el navegador bloquea ese bloque y lo reporta en consola. Las fuentes de respaldo no se probaron (la pantalla de ingreso no las usa).

| Excepción | Motivo | Decisión pendiente |
|---|---|---|
| `script-src 'wasm-unsafe-eval'` | El renderer canvaskit compila `canvaskit.wasm`. Solo permite WebAssembly, no `eval` de JavaScript. | Ninguna. |
| `script-src 'sha256-…'` | Hash del bloque inline `splash-screen-script` de `app/web/index.html`. Si se regenera el splash, cambia el hash: `bin/verificar-nginx app` falla y avisa. | Ninguna. |
| `https://www.gstatic.com/flutter-canvaskit/` en `script-src` y `connect-src` | El motor carga canvaskit de su CDN por omisión; `flutter build web` no tiene opción para servirlo desde el propio sitio. | Autohospedar canvaskit con un `web/flutter_bootstrap.js` propio (`canvasKitBaseUrl`) y quitar la excepción. |
| `connect-src https://fonts.gstatic.com/s/` | Fuentes de respaldo del motor para glifos que no están en las fuentes incluidas. Sin ella esos glifos no se ven. | Aceptar, o incluir las fuentes que hagan falta en `assets/`. |
| `style-src 'unsafe-inline'` | El motor inserta sus propios estilos. Sin ella el navegador los bloquea y lo reporta en consola (la pantalla de ingreso se ve igual). No es excepción de script. | Quitarla si el motor admite nonce o hash para sus estilos. |
| `img-src 'self' data: blob:` | Sin justificar: ni `data:` ni `blob:` se probaron en la app; quedaron en la directiva. | Probar sin `data:` y sin `blob:` con Chrome headless y quitar lo que no haga falta. |

### Cómo se prueba

`bin/verificar-nginx panel` y `bin/verificar-nginx app` sirven la configuración real con el build (con Docker, la imagen `nginxinc/nginx-unprivileged` de los Dockerfile; sin Docker, el nginx del host) y comprueban: sintaxis, cabeceras, caché solo en `/assets/` y en 2xx, 404 para archivos inexistentes, fallback SPA solo para rutas sin extensión, la ausencia de script o estilo en línea en el panel, el `img-src 'self' blob:` del panel, la respuesta de la API caída (503 problema+json, `no-store`, una sola `Cache-Control`) y el hash del splash. Corren en `bin/verify` y en la CI (`ci.yml`, jobs `web` y `app`).

### Pendiente: `X-Forwarded-Proto`

El Nginx del CT envía `X-Forwarded-Proto $scheme`. Entre NPMplus y el CT el esquema es `http`, aunque el navegador use `https`. La API va a necesitar el valor público para la cookie `Secure` y la comprobación de `Origin` (ADR 0033 §5). Falta decidir cómo se pasa el valor que pone NPMplus.

## Hallazgos de seguridad

Un secreto filtrado, una dependencia con aviso alto o un hallazgo de CodeQL tienen su procedimiento
en `docs/gestion/seguridad-ci.md`. Un secreto real se rota en su origen antes que nada: el
`PIN_PIMIENTA` no se cambia sin un plan de migración de PIN (ADR 0018).

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

## Migraciones que tocan tablas grandes (`eventos_acceso`, `sesiones`)

La placa escribe un `eventos_acceso` por cada lectura de QR: un `ALTER` que bloquee esa tabla deja las puertas sin registrar intentos (y, por falla segura, sin abrir). Por eso la migración `20261102100003_add_indices_de_senales` (ola W12):

- declara `ALGORITHM=INPLACE, LOCK=NONE` en cada `ALTER`: si MariaDB no puede cumplirlo, el paso **falla** en vez de bloquear escrituras;
- fija `SET SESSION lock_wait_timeout = 5` antes: el `ALTER` necesita un bloqueo de metadatos breve al empezar y al terminar, y si hay una transacción larga abierta sobre la tabla se queda en cola **bloqueando a todas las demás**. Con 5 s falla pronto y no deja la cola formada.

Antes de migrar en producción: busca transacciones largas (`SELECT * FROM information_schema.innodb_trx ORDER BY trx_started`), aplica fuera de la hora pico y, si falla por el tiempo de espera, reintenta. Cualquier índice o columna nueva sobre estas tablas sigue la misma regla.
