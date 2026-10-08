# ADR 0014 — master se actualiza solo por tag de versión

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0027 de ACRECIA · **Complementa:** ADR 0006

## Decisión

- **`auto-merge.yml`**: solo atiende PR hacia `develop` cuya rama sea `feature/*` o `bugfix/*`. Espera el check `ci` (resumen de los jobs `api`, `app` y `firmware` de `ci.yml`) y hace squash con `--delete-branch`. Los borradores se saltean. No usa el auto-merge nativo de GitHub, que en repos privados del plan Free no está disponible.
- **`release.yml`**: un tag `vX.Y.Z` sobre un commit de `develop` o de `fix/*` vuelve a pasar `ci.yml`, se integra en `master` con merge commit (`--no-ff`) y publica el GitHub Release. Si el tag vino de `fix/*`, también lo reincorpora en `develop`.
- **No hay PR hacia `master`.** `master` = la última versión publicada.
- **Versión única** para el monorepo: el tag fija la versión de la API (`package.json`), de la app (`pubspec.yaml`, `version: X.Y.Z+<build>`) y del firmware (`FIRMWARE_VERSION`).
- **Artefactos del release** (cuando existan las partes): APK/AAB firmado, build web y `firmware-vX.Y.Z.bin` con su hash SHA-256 para OTA. La firma de Android y la de OTA van en GitHub Actions secrets.
- **Deploy**: cuando haya servidor, se cuelga del push a `master` que hace `release.yml` (imagen de producción de la API + build web servido por Nginx en `acceso.agrocom.com.bo`).

## Consecuencias

- Para publicar: `git tag -a vX.Y.Z -m vX.Y.Z` sobre `develop` (o sobre la `fix/*`) y `git push origin vX.Y.Z`.
- `release.yml` hace push a `master` y a `develop` con `GITHUB_TOKEN`: si esas ramas se protegen, hay que permitir el bypass de GitHub Actions.
- Requiere **Settings → Actions → General → Workflow permissions: Read and write**.
- Un binario de firmware publicado nunca lleva secretos: las credenciales viven en la NVS de cada placa (ADR 0009).
