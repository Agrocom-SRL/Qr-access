# ADR 0014 — master se actualiza solo por tag de versión

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0027 de ACRECIA · **Complementa:** ADR 0006

## Decisión

- **`auto-merge.yml`**: solo atiende PR hacia `develop` cuya rama sea `feature/*` o `bugfix/*`. Espera el check `ci` (resumen de los jobs `api`, `app` y `firmware` de `ci.yml`) y hace squash con `--delete-branch`. Los borradores se saltean. No usa el auto-merge nativo de GitHub, que en repos privados del plan Free no está disponible.
- **`release.yml`**: un tag `vX.Y.Z` sobre un commit de `develop` o de `fix/*` vuelve a pasar `ci.yml`, se integra en `master` con merge commit (`--no-ff`) y publica el GitHub Release. Si el tag vino de `fix/*`, también lo reincorpora en `develop`.
- **No hay PR hacia `master`.** `master` = la última versión publicada.
- **Versión única** para el monorepo: el tag fija la versión de la API (`package.json`), de la app (`pubspec.yaml`, `version: X.Y.Z+<build>`) y del firmware (`FIRMWARE_VERSION`).
- **Artefactos del release** (cuando existan las partes): APK/AAB firmado, build web y `firmware-vX.Y.Z.bin` con su hash SHA-256 para OTA. La firma de Android y la de OTA van en GitHub Actions secrets.
- **Deploy**: `deploy.yml` se dispara con el push a `master` que hace `release.yml` y corre en un runner self-hosted (`acceso-prod`) dentro del CT 120 de Proxmox. `bin/desplegar` construye la API, la app y el panel, migra, siembra el catálogo y levanta `docker-compose.prod.yml` con MySQL 8.4 en contenedor. NPMplus (CT 107) termina el TLS de `acceso.agrocom.com.bo`. Detalle y comandos del servidor en `docs/gestion/despliegue.md`.

## Consecuencias

- Para publicar: `git tag -a vX.Y.Z -m vX.Y.Z` sobre `develop` (o sobre la `fix/*`) y `git push origin vX.Y.Z`.
- `release.yml` empuja a `master` con una **deploy key con escritura** (secreto `RELEASE_DEPLOY_KEY`), no con `GITHUB_TOKEN`: el ruleset de `master` restringe `update` y GitHub no permite poner a `GITHUB_TOKEN` (ni a la app GitHub Actions) en el bypass; sí permite **Deploy keys**. El ruleset de `master` debe tener *Deploy keys* en su bypass.
- La reincorporación en `develop` (tags desde `fix/*`) exigiría lo mismo en el ruleset de `develop`, que además pide PR y check `ci`; mientras no se use ese camino, queda pendiente.
- Una deploy key con escritura salta la protección de `master`: la clave privada solo vive en el secreto de Actions y se rota si se sospecha de una fuga.
- El job `release` declara `permissions: contents: write`; no depende de que los permisos por defecto del repo sean de escritura (la organización puede fijarlos en solo lectura).
- Un binario de firmware publicado nunca lleva secretos: las credenciales viven en la NVS de cada placa (ADR 0009).
