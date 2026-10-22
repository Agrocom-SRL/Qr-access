# Release de la jerarquía de usuarios (propuesta)

**Fecha:** 2026-10-22 · **Estado:** propuesta. **No se publicó ningún tag, no se desplegó nada y no se cambió ninguna versión.** Todo paso marcado como **[Confirmar]** requiere la confirmación de Miguel.

Incluye lo integrado en `develop` desde el 2026-10-13 que cambia el contrato con los clientes: ADR 0028 (#59-#61, #64-#68), compartir el PIN (#68), "generar" en lugar de "emitir" (#71) y el permiso `accesos.qr.generar_propio` (#72). El detalle de cada cambio está en `docs/gestion/estado_proyecto.md`.

## 1. Qué cambia para quien ya tiene una versión instalada

Es un **cambio incompatible para los clientes instalados** (app Android y cualquier cliente que lea los permisos o los campos de la API).

| Cambio | Dónde | Efecto en un cliente instalado |
|---|---|---|
| `accesos.qr.emitir` pasa a `accesos.qr.generar` | permisos (`db/migrations/20261022100007`, `db/seeds/01_catalogo.sql`) | La app vieja busca el permiso viejo y oculta o rechaza "Generar QR". |
| Nuevo `accesos.qr.generar_propio` (QR propio) | seed `01_catalogo.sql` | La app vieja no conoce el permiso; el Guardia solo tiene el QR propio. |
| `emitido_por` pasa a `generado_por` (columna y campo de la API); `emisor` pasa a `generador` | `20261022100007` y las respuestas de `/api/v1` | Una app vieja que lee el campo viejo muestra datos vacíos. **[Confirmar en el OpenAPI antes de publicar.]** |
| Un rol por usuario; se quitan el rol activo y el cambio de rol | ADR 0028 §2 y §8; `20261022100003` | El JWT ya no lleva rol activo: **todas las sesiones existentes dejan de valer** y hay que volver a entrar. |
| Rol *Usuario* pasa a *Miembro*; nuevos *Titular* y *Guardia* | ADR 0028 §8 | Los textos y el selector de rol cambian. |
| Guardia pierde `accesos.qr.generar` | seed `01_catalogo.sql` | El Guardia ya no genera QR de visitas (esperado por ADR 0028 §5). |
| Nuevas tablas y columnas: `unidades`, `usuarios.superior_id`, tope de Miembros por cuenta, PIN compartido | `20261022100001` a `20261022100006`; y `20261021100001` (**[Confirmar]** los nombres de columna en el esquema) | Sin efecto para clientes viejos, pero la API nueva exige la base migrada. |

**Conclusión:** la API, la app y el panel web se despliegan juntas. La web y la app web las sirve el mismo despliegue (`docs/gestion/despliegue.md`); solo el APK instalado queda desfasado.

**[Confirmar]:** cómo llega el APK a los usuarios (no consta en los documentos) y el aviso que se les dará.

## 2. Versión

### Estado actual

| Archivo | Versión hoy | Observación |
|---|---|---|
| `api/package.json` | `1.0.0` | `api/package-lock.json` también lleva el campo `version`; **verificar** antes de cambiarlo. |
| `web/package.json` | `1.0.0` | `web/package-lock.json`: igual que la API. |
| `app/pubspec.yaml` | `1.0.0+7` | El número de build es el de Android. |
| `firmware/include/version.h` | `1.0.0` (y `1.0.0-dev` con `ACCESO_DESARROLLO`) | Sin cambios verificados desde el último tag (ver abajo). |
| `api/src/plugins/openapi.ts` (línea 11) | `version: '1'` | **No cambiar.** Es la versión del contrato `/api/v1` (ADR 0005), no la del release. |
| Tags en el repo | `v0.5.0`, `v1.0.0`, `v1.0.1`, `v1.0.2` | El último es `v1.0.2`. Se leyó de `.git/packed-refs`. |

**Contradicción a resolver:** ADR 0014 dice que la versión es **única para el monorepo** y que el tag fija la versión de la API, la app y el firmware. Pero los archivos siguen en `1.0.0` aunque existen los tags `v1.0.1` y `v1.0.2`. **[Confirmar]** qué cambió en `v1.0.1` y `v1.0.2`, y si el firmware publicado quedó en `1.0.0`.

Tampoco pude verificar desde esta sesión si el firmware cambió después de `v1.0.2`. El historial indica cambios grandes de firmware en #37-#45 (Ethernet, vinculación, lector RS485), así que hay que suponer que sí.

### Decidido (2026-10-22, Miguel): solo sube el último índice

No se pasa a 2.0.0. La versión sigue la línea 1.0.x: como ya existen los tags `v1.0.1` y `v1.0.2`, el release es **1.0.3**, y el build de la app sube de `+7` a `+8` (o al que ya use la distribución). Los archivos siguen en `1.0.0` y se ponen en `1.0.3` al preparar el release.

### Archivos a cambiar (en un PR a `develop`, antes del tag)

- `api/package.json`: `"version": "1.0.3"`, y el campo `version` de `api/package-lock.json`.
- `web/package.json`: `"version": "1.0.3"`, y el de `web/package-lock.json`.
- `app/pubspec.yaml`: `version: 1.0.3+8`.
- `firmware/include/version.h`: `#define FIRMWARE_VERSION "1.0.3"` (la rama `ACCESO_DESARROLLO` queda como `1.0.3-dev`).
- **No** cambiar `api/src/plugins/openapi.ts` ni los nombres de rama.

## 3. Pasos del release

Los pasos siguen `CONTRIBUTING.md`, `docs/gestion/despliegue.md` y `.github/workflows/release.yml`.

### Fase A. Antes del tag (todo por PR, sin tag)

1. Confirmar que #72 y #74 están integrados en `develop` y que el PR de `feature/diseno-jerarquia-y-cierre` (estos documentos) entró.
2. **[Confirmar]** la decisión sobre el contrato `/api/v1` (sección 5, punto 2).
3. Crear la rama de la versión desde `develop` actualizado. Nombre sugerido: `feature/version-jerarquia` (la regla de `CONTRIBUTING.md` pide 2 o 3 palabras de la función). Cambiar los archivos de la sección 2.
4. `./bin/verify` completo (API, app, firmware y web) en verde. Abrir PR contra `develop`; el auto-merge lo integra cuando `ci` queda verde.
5. Revisión línea por línea del filtro por rama y del modelo de permisos (ADR 0028 "Consecuencias"; CLAUDE.md, "no delegar"). No consta como hecha.
6. Revisión visual en un entorno levantado (punto pendiente real del cierre), con `db/seeds/02_demo.sql` en desarrollo. Incluye comprobar que el Guardia no ve "Generar QR" de visitas.
7. Confirmar que `develop` queda con `ci` verde después del merge del PR de versión.

### Fase B. Respaldo y reinicio de la base de producción (antes del tag)

El orden importa: **el push a `master` que hace `release.yml` dispara `deploy.yml`, que corre `./bin/desplegar` solo** (`.github/workflows/deploy.yml`). Si el tag se publica antes de reiniciar la base, el despliegue migra la base vieja. Por eso la fase B va antes de la fase C.

Reinicio según `docs/gestion/jerarquia-de-usuarios.md` §13 y ADR 0028 ("Datos de producción"). **[Confirmar]** que se autoriza el reinicio: es una excepción explícita a la regla de no hacer `DROP DATABASE`, y solo aplica a producción, con respaldo previo.

1. **Snapshot del CT 120** en Proxmox. Es la vuelta atrás completa (sección 6).
2. **Respaldo lógico** en el CT, desde el repo:
   ```
   docker compose -p acceso --env-file /opt/acceso/.env -f docker-compose.prod.yml exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction acceso' | gzip > acceso-$(date +%F).sql.gz
   ```
   Verificar que el archivo no está vacío y que se lee (`gunzip -t`). **Guardarlo fuera del CT.** Es la única copia de los datos de la primera prueba.
3. Comprobar que `/opt/acceso/.env` **aún tiene `ADMIN_INICIAL_CLAVE`**. `bin/desplegar` la necesita para recrear `root` cuando la base esté vacía. `despliegue.md` dice que se borra después del primer arranque; si ya se borró, volver a ponerla antes del paso 5.
4. Detener la API del CT: `docker compose -p acceso --env-file /opt/acceso/.env -f docker-compose.prod.yml stop api` (y `app` y `panel`, para que nadie entre a mitad del reinicio). Nunca `down -v` ni `docker volume rm`.
5. Recrear la base dentro del contenedor `db` (con la misma colación que usa el proyecto):
   ```
   DROP DATABASE acceso;
   CREATE DATABASE acceso CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   ```
   Verificar que no quedan tablas y que el usuario `acceso` conserva sus permisos sobre la base.

### Fase C. Publicar (solo con confirmación de Miguel)

6. En el repo local: `git checkout develop && git pull` y confirmar que el commit de versión está.
7. Crear el tag sobre `develop` y subirlo (ADR 0014):
   ```
   git tag -a v1.0.3 -m "v1.0.3"
   git push origin v1.0.3
   ```
8. `release.yml`: vuelve a correr la CI sobre el commit, integra en `master` con `--no-ff` y publica el GitHub Release con notas automáticas. Verificar el release y que `master` contiene el commit.
9. `deploy.yml` corre `./bin/desplegar` en el runner `acceso-prod`. Seguir el log: construye las imágenes, aplica todas las migraciones sobre la base vacía, siembra `01_catalogo.sql`, crea `root` con `contrasena_temporal = 1` y espera a `/api/v1/salud`.
   - **Seeds:** solo `01_catalogo.sql` (lo corre el script). **No** `02_demo.sql`, que es solo de desarrollo.
   - **[Confirmar]** que `01_catalogo.sql` no crea cuentas ni roles de cuenta: en ADR 0028 los roles base (Administrador, Titular, Miembro y Guardia) los crea la API al dar de alta una cuenta.

### Fase D. Recrear los datos de la cuenta (después del despliegue)

10. Entrar como `root` con `ADMIN_INICIAL_CLAVE`, cambiar la contraseña (el panel lo exige) y **quitar `ADMIN_INICIAL_CLAVE` del `.env`**.
11. Dar de alta la cuenta del cliente en el panel: cuenta, plan, suscripción, responsable y su Administrador (`jerarquia-de-usuarios.md` §13, "se recrea el Administrador"). **[Confirmar]** el código de la cuenta (ADR 0023 permite cambiarlo) y los datos del Administrador.
12. Recrear propiedades (antes "sitios") y puertas. **[Confirmar]:** el §13 no lo menciona, pero el reinicio borra también estas tablas.
13. Placas: se anuncian solas (ADR 0026) y aparecen en el panel como detectadas. Hay que confirmarlas manteniendo 5 s el pulsador de salida y asignarlas a su puerta. **[Confirmar]** si las placas ya tienen un firmware que anuncie (si no, reflashear por USB; OTA queda fuera de V1).
14. El Administrador crea de nuevo a sus Titulares, Guardias y Miembros, y comparte el PIN. Las sesiones previas no valen.

## 4. Verificación posterior

- `curl -fsS http://127.0.0.1/api/v1/salud` en el CT (lo usa `bin/desplegar`) y `https://acceso.agrocom.com.bo/api/v1/salud`.
- `GET /api/v1/openapi.json`: la versión del contrato sigue en `1` y aparecen los nombres nuevos (`accesos.qr.generar`, `generar_propio`, y el campo de generador).
- En la base (solo lectura):
  - `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;` debe dar `20261022100007` (o la última que exista en el repo).
  - `SELECT codigo FROM permisos WHERE codigo LIKE 'accesos.qr.%';` debe dar `accesos.qr.generar` y `accesos.qr.generar_propio`, sin `accesos.qr.emitir`.
  - `SELECT COUNT(*) FROM usuarios WHERE tenant_id IS NULL AND username = 'root';` debe dar `1`.
- Entrar al panel como `root` y cambiar la contraseña.
- Con el Administrador real: crear un Titular, un Guardia y un Miembro; generar un QR de visita (que el Guardia no debe poder generar) y uno propio con el Guardia; registrar un acceso de prueba y confirmar que aparece en `eventos_acceso` y en la bitácora.
- `docker compose logs --tail 100 api` sin errores.
- Placas: aparecen como detectadas y latido con la versión de firmware esperada.

## 5. Decisiones para Miguel

1. **Versión:** 1.0.3 (decidido). Falta saber qué trajeron v1.0.1 y v1.0.2.
2. **Contradicción con ADR 0005 y la invariante 11 de `CLAUDE.md`:** ambos prohíben un cambio incompatible dentro de la misma versión de la API. Los cambios de permisos y campos de #71 y #72 lo son. Opciones: (a) documentar la excepción en un ADR, porque los clientes instalados son pocos y la app web va con la API; (b) publicar `/api/v2`. Elegir una antes de publicar.
3. **Reinicio de producción:** autorizar el `DROP DATABASE` con respaldo previo. **Conflicto a tener en cuenta:** la invariante 4 dice que `eventos_acceso` no se borra. El reinicio borra también la bitácora y los eventos de la primera prueba. Si se acepta, la excepción debe quedar en el PR (invariante 8) y en el ADR 0028.
4. **Dónde se guarda el respaldo** y por cuánto tiempo.
5. **Código de la cuenta y datos del Administrador** al recrearla (paso 11).
6. **Placas:** reflasheo por USB si hace falta, y la versión de firmware de la release.
7. **Aviso a los clientes** y forma de distribución del APK.
8. **Vuelta atrás:** snapshot de Proxmox como plan principal, y qué hacer con `master` si hay que revertir (sección 6).
9. **Fecha del tag** y ventana de mantenimiento.
10. **Tags `v1.0.1` y `v1.0.2`:** qué contienen y por qué los archivos siguen en `1.0.0`.

## 6. Plan de vuelta atrás

Criterios para volver atrás: `bin/desplegar` no llega a `/api/v1/salud`; el Administrador no puede entrar; o una migración falla.

**Antes del tag (fase B):** si algo falla, no hay despliegue. Recargar el respaldo en la base recreada (`gunzip -c acceso-AAAA-MM-DD.sql.gz | mysql ...` dentro del contenedor `db`, con `--default-character-set=utf8mb4`) y volver a levantar la versión anterior.

**Después del tag:**
1. **Preferido:** restaurar el snapshot del CT 120 en Proxmox. Devuelve el código, la base y el `.env` tal como estaban.
2. **Sin snapshot:**
   a. Detener `api`, `app` y `panel`.
   b. Recrear la base y cargar el respaldo.
   c. En el checkout del CT, `git checkout v1.0.2` y `./bin/desplegar`. Verificar antes que `schema_migrations` del respaldo coincide con las migraciones de `v1.0.2`; si no, desplegar la versión que sí coincida.
   d. **No** hacer push a `master` mientras `master` apunte a `v1.0.3`: el push dispara `deploy.yml` otra vez.
3. **Problema de `master`:** revertir a mano requiere saltar la protección (la deploy key solo está en `release.yml`). Está sin decidir. La alternativa del flujo es corregir hacia adelante con `fix/*` y un tag `v2.0.1` (ADR 0014).
4. **Datos:** la vuelta atrás con respaldo devuelve los datos del respaldo. Lo que se creó después del reinicio (cuenta nueva, usuarios, eventos) se pierde.
5. **Clientes:** si la app v2 ya está instalada, también necesitará la API v2. Avisar antes de revertir.
6. **Placas:** si las placas tienen firmware nuevo, no está verificado que funcionen con la API anterior.
