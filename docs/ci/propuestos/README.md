# Workflows propuestos (pendientes de instalar)

Esta carpeta guarda workflows que **no están activos**. El token con el que se trabajó no puede
subir archivos a `.github/workflows/`, así que el workflow se deja aquí, revisado y listo, para que
lo instale alguien con permiso de escritura en esa ruta.

## Qué hay

| Archivo propuesto | Ruta final | Qué hace | Estado |
|---|---|---|---|
| `seguridad.yml` | `.github/workflows/seguridad.yml` | `npm audit` (api y web), escaneo de secretos (gitleaks 8.24.3 fijado) y CodeQL (`javascript-typescript` y `actions`) | Pendiente de instalar |

Lo que no es workflow ya está en su sitio final: `.gitleaks.toml` en la raíz, `bin/licencias`,
`.github/dependabot.yml` (npm para `/api`) y `docs/gestion/seguridad-ci.md`.

## Cómo instalarlo (Miguel)

1. Partir de `develop` actualizado y crear una rama, por ejemplo `feature/ci-seguridad`
   (la rama de trabajo `claude/w2-ci-seguridad` no se integra tal cual).
2. Copiar el workflow a su ruta final y quitar la propuesta:
   ```
   cp docs/ci/propuestos/seguridad.yml .github/workflows/seguridad.yml
   git rm -r docs/ci/propuestos
   ```
3. Comprobar la sintaxis (actionlint no está en el repo; instalarlo localmente o con Docker):
   ```
   actionlint .github/workflows/seguridad.yml
   ```
4. Activar **GitHub Advanced Security** en el repo (Settings > Code security). CodeQL no sube
   resultados en un repo privado sin esa licencia; si la organización no la tiene, quita el job
   `codeql` del archivo antes de integrarlo, o el job fallará en cada PR. Conviene activar también
   *Secret scanning* y *Push protection* (Settings > Code security): es la capa de secretos de
   GitHub, complementaria a gitleaks.
5. Abrir el PR a `develop`. Comprobar que aparecen los checks `npm audit (api)`,
   `npm audit (web)`, `escaneo de secretos (gitleaks)` y `CodeQL (...)`, y que el check `ci` y
   el auto-merge no cambian de comportamiento.
6. Tras integrarlo: el escaneo programado (lunes 06:17 UTC) solo corre desde la rama por defecto,
   así que empieza a aparecer cuando el archivo ya está ahí.

## Decisiones que quedan abiertas

- **Bloqueante o informativo.** Hoy estos checks no están en `needs` del job `ci` (auto-merge.yml
  solo exige `ci`). Para que bloqueen la integración hay que sumarlos a `needs` en `ci.yml`.
  Eso cambia el gate, así que lo decide Miguel (ADR 0033 y 0006).
- **Dart y firmware.** CodeQL no cubre Flutter/Dart ni el firmware de PlatformIO en este
  workflow. Qué cubre cada parte está en `docs/gestion/seguridad-ci.md`.
