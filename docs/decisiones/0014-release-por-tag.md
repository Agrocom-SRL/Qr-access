# ADR 0014 — master se actualiza solo por tag de versión

**Estado:** Aceptada (2026-10-08), modificada el 2026-10-27: la versión deja de ser única para el monorepo y pasa a ser por componente (ver "Versión por componente") · **Origen:** ADR 0027 de ACRECIA · **Complementa:** ADR 0006

> **Nota 2026-10-27 (Miguel).** La versión del proyecto cuando se lanza a producción no es la versión de cada componente: el firmware y la API llevan tiempo sin cambios, mientras que la app y el panel web cambian seguido. Forzar los cuatro números al del tag obliga a subir versiones de piezas que no cambiaron. Se quita la restricción de "versión única"; el resto del ADR sigue vigente.

## Decisión

- **`auto-merge.yml`**: solo atiende PR hacia `develop` cuya rama sea `feature/*` o `bugfix/*`. Espera el check `ci` (resumen de los jobs `api`, `app` y `firmware` de `ci.yml`) y hace squash con `--delete-branch`. Los borradores se saltean. No usa el auto-merge nativo de GitHub, que en repos privados del plan Free no está disponible.
- **`release.yml`**: un tag `vX.Y.Z` sobre un commit de `develop` o de `fix/*` vuelve a pasar `ci.yml`, se integra en `master` con merge commit (`--no-ff`) y publica el GitHub Release. Si el tag vino de `fix/*`, también lo reincorpora en `develop`.
- **No hay PR hacia `master`.** `master` = la última versión publicada.
- **Versión por componente** (reemplaza a la antigua "versión única"; ver sección siguiente).
- **Artefactos del release** (cuando existan las partes): APK/AAB firmado, build web y `firmware-v<versión del firmware>.bin` con su hash SHA-256 para OTA (el nombre lleva la versión del firmware, no la del tag). La firma de Android y la de OTA van en GitHub Actions secrets.
- **Deploy**: `deploy.yml` se dispara con el push a `master` que hace `release.yml` y corre en un runner self-hosted (`acceso-prod`) dentro del CT 120 de Proxmox. `bin/desplegar` construye la API, la app y el panel, migra, siembra el catálogo y levanta `docker-compose.prod.yml` con MySQL 8.4 en contenedor. NPMplus (CT 107) termina el TLS de `acceso.agrocom.com.bo`. Detalle y comandos del servidor en `docs/gestion/despliegue.md`.

## Versión por componente

Hay dos clases de número y no se confunden:

- **Versión del proyecto (lanzamiento):** el tag `vX.Y.Z`. Identifica un lanzamiento a producción como conjunto: el commit de `master` que se despliega. Se sube en cada lanzamiento.
- **Versión del componente:** cada pieza lleva la suya, con semver propio, y **solo sube cuando ese componente cambia**:

| Componente | Dónde vive la versión |
|---|---|
| API | `api/package.json` (`version`) |
| Panel web | `web/package.json` (`version`) |
| App | `app/pubspec.yaml`, `version: X.Y.Z+<build>` |
| Firmware | `firmware/include/version.h` (`FIRMWARE_VERSION`) |

Reglas:

- El tag **ya no obliga** a que los cuatro archivos coincidan con él. Un componente sin cambios conserva su versión entre lanzamientos.
- Quien cambia un componente sube su versión en el mismo PR (o en el PR previo al tag) según semver de ese componente; el número de build de la app sube con cada APK distribuido.
- `/api/v1` (ADR 0005) sigue siendo la versión del contrato, independiente de la versión de `api/package.json`.
- Un cambio que cruza componentes (por ejemplo, un contrato nuevo que la app consume) se anota en el registro de abajo, para saber qué versión de la app exige qué versión de la API.

### Registro de versiones por lanzamiento

Fuente: los archivos tal como están el 2026-10-27, en el lanzamiento más reciente publicado. Los lanzamientos anteriores no se reconstruyen aquí; desde ahora se añade una fila por cada tag nuevo, con los valores de los archivos en ese commit.

| Lanzamiento (tag) | API | Panel web | App | Firmware |
|---|---|---|---|---|
| `v1.0.5` | 1.0.5 | 1.0.5 | 1.0.5+10 | 1.0.5 |

El tag `v1.0.5` figura como publicado en `docs/gestion/plan-maestro.md`. Al ser el último lanzamiento hecho con versión única, los cuatro valores coinciden; a partir del siguiente tag pueden diferir.

## Consecuencias

- Cada componente puede subir su versión sin tocar a los demás; el tag deja de ser una orden de alinear números.
- **Pendiente, en una feature aparte (no se ajusta en este cambio):**
  - `release.yml` nombra el release solo con el tag y no lee ninguna versión de componente. Cuando se adjunten artefactos (hoy es un comentario), el nombre del `.bin` y del APK debe tomar la versión de su componente (de `version.h` y de `pubspec.yaml`), no `$TAG`.
  - Ni `release.yml` ni `deploy.yml` ni `bin/desplegar` comparan el tag con las versiones de los archivos; no hay chequeo que exija coincidencia, así que no hay nada que quitar. Conviene en su lugar un chequeo que falle si un componente cambió desde el lanzamiento anterior y su versión no subió.
  - Generar el registro de versiones por lanzamiento (por ejemplo desde `release.yml`, que ya publica el Release) en vez de mantenerlo a mano.
  - `bin/estado-plan` compara solo contra el último tag; si se quiere mostrar la versión por componente, hay que añadirlo.
  - La OTA del firmware (cuando exista) debe comparar la versión del firmware, no la del tag.
  - `README.md` (sección "Versión") sigue diciendo "una sola versión para todo el monorepo" y debe actualizarse junto con lo anterior.
- Para publicar: `git tag -a vX.Y.Z -m vX.Y.Z` sobre `develop` (o sobre la `fix/*`) y `git push origin vX.Y.Z`.
- `release.yml` empuja a `master` con una **deploy key con escritura** (secreto `RELEASE_DEPLOY_KEY`), no con `GITHUB_TOKEN`: el ruleset de `master` restringe `update` y GitHub no permite poner a `GITHUB_TOKEN` (ni a la app GitHub Actions) en el bypass; sí permite **Deploy keys**. El ruleset de `master` debe tener *Deploy keys* en su bypass.
- La reincorporación en `develop` (tags desde `fix/*`) exigiría lo mismo en el ruleset de `develop`, que además pide PR y check `ci`; mientras no se use ese camino, queda pendiente.
- Una deploy key con escritura salta la protección de `master`: la clave privada solo vive en el secreto de Actions y se rota si se sospecha de una fuga.
- El job `release` declara `permissions: contents: write`; no depende de que los permisos por defecto del repo sean de escritura (la organización puede fijarlos en solo lectura).
- Un binario de firmware publicado nunca lleva secretos: las credenciales viven en la NVS de cada placa (ADR 0009).
