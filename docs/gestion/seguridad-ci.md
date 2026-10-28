# Seguridad en CI: qué se revisa, cómo y qué hacer ante un hallazgo

Fuente: ADR 0033 §2 (defensas de la plataforma, «Dependencias y secretos»). Complementa
`docs/gestion/despliegue.md` y la skill `seguridad-plataforma`.

Estado: el workflow `seguridad.yml` está **propuesto** en `docs/ci/propuestos/`, pendiente de
instalar (ver su README). Las herramientas y configuraciones de aquí ya existen en el repo y se
probaron en local (2026-10-26).

## Qué corre y cuándo

| Check | Herramienta | Partes | Cuándo | Bloquea la integración |
|---|---|---|---|---|
| npm audit de producción | `npm audit --omit=dev --audit-level=high` | api, web | PR a develop/master, lunes, a mano | Dentro de su job sí; el job no está en `needs` de `ci`, así que hoy no bloquea (ver más abajo) |
| npm audit completo | `npm audit --audit-level=high` | api, web | igual | No (informativo, `continue-on-error`) |
| Escaneo de secretos | gitleaks 8.24.3 (binario fijado con SHA-256) | todo el repo | PR (commits del rango), lunes (historial completo) | Igual que el anterior |
| Análisis estático | CodeQL `javascript-typescript` y `actions` | api, web, workflows | PR, lunes | Igual; los resultados van a la pestaña Security |
| Revisión de licencias | `bin/licencias` | api, web (producción) | A mano | No es CI: exit 1 obliga a revisar |
| Actualizaciones de dependencias | Dependabot (npm `/api` y `/web`, actions) | api, web, actions | Semanal, PR a develop | No; los PR se revisan a mano |

Los checks de seguridad **no** son el check requerido: auto-merge.yml solo espera `ci`. Sumarlos a
`needs` del job `ci` en `ci.yml` los vuelve bloqueantes. Es un cambio de gate: lo decide Miguel.

## Cobertura por parte (lo que sí y lo que no)

| Parte | Dependencias | Secretos | Análisis estático |
|---|---|---|---|
| `api` (Node/TypeScript) | npm audit (prod bloqueante, dev informativo) y Dependabot | gitleaks | CodeQL `javascript-typescript` |
| `web` (React/TypeScript) | igual | gitleaks | CodeQL `javascript-typescript` (el mismo análisis cubre `web/`) |
| `app` (Flutter/Dart) | **No.** No hay auditoría de pub en CI; Dependabot para `pub` queda pendiente | gitleaks (cubre el repo entero) | **No.** CodeQL no analiza Dart (verificar en la documentación vigente de CodeQL) |
| `firmware` (C++, PlatformIO) | **No.** Dependabot no soporta PlatformIO: las versiones de `platformio.ini` se revisan a mano al actualizar | gitleaks (cubre lo versionado; `secretos.h` no se versiona) | **No.** CodeQL soporta C/C++, pero su análisis necesita la compilación de PlatformIO (o un modo sin compilar, menos preciso); queda como paso siguiente |
| Imágenes Docker | **No.** Sin escaneo de imagen (p. ej. Trivy) | — | — |
| Workflows de GitHub Actions | — | — | CodeQL `actions` |

Huecos conocidos: dependencias de Flutter y de PlatformIO, escaneo de imágenes Docker, y las
imágenes base de los Dockerfile. Se decide cada uno aparte; no están en el alcance de ADR 0033 §2.

## Política de `npm audit`

1. **Umbral:** `high` (incluye `critical`). Por debajo de `high` no se bloquea.
2. **Producción bloquea, desarrollo informa.** Lo que llega al servidor o al panel (sin
   devDependencies) es bloqueante. Las devDependencies corren en CI y en el build, pero no se
   despliegan: su aviso se revisa cada semana, y si afecta a algo que corre fuera de la CI, sube a
   producción.
3. **Cómo se corrige un aviso:**
   - actualizar el paquete directo en un PR `bugfix/...` con el lockfile;
   - si el aviso viene de un paquete transitivo sin parche directo, fijar la versión con
     `overrides` en `package.json` (ya se usa en `web/` para `uuid`);
   - nunca `npm audit fix --force` sin revisar el cambio de versión mayor.
4. **Falso positivo o aviso sin corrección.** No se salta el gate en silencio ni se baja el umbral.
   - Confirmar en el aviso (GHSA/CVE) que la versión instalada está afectada y que el proyecto
     alcanza esa función.
   - Si no la alcanza, o no hay parche, abrir una excepción en la sección «Excepciones vigentes»
     con: id, paquete y versión, motivo, quién la aprueba (Miguel) y fecha de revisión (no más de
     30 días).
   - Que el workflow ignore un id requiere un PR visible con esa excepción, aprobado por Miguel.
     `npm audit` no tiene lista de ignorados nativa; no se agrega otra herramienta (p. ej.
     `audit-ci`) sin una necesidad que lo justifique.

**Excepciones vigentes:** ninguna.

**Resultado 2026-10-26:** `npm audit` en `api` y en `web`, con y sin devDependencies: 0
vulnerabilidades (0 info, 0 low, 0 moderate, 0 high, 0 critical). Se comprobó que la compuerta
falla ante una versión vulnerable conocida (lodash 4.17.15, en un proyecto de prueba).

## Escaneo de secretos (gitleaks)

- **Configuración:** `.gitleaks.toml` en la raíz. Usa las reglas por defecto de gitleaks y una
  sola excepción: los dos valores de **prueba** que `api/test/setup.ts` fija para los tests
  (`JWT_SECRETO` y `PIN_PIMIENTA` de pruebas). No son secretos reales (el entorno real los trae de
  `.env` o del servidor, invariante 6). La excepción es por **valor exacto**: en gitleaks 8.24, un
  `[allowlist]` global combina `paths` y `regexes` con O, así que acotar por ruta no restringe nada.
  Por eso cualquier otro secreto, también en ese archivo, se sigue detectando (probado).
- **Qué escanea:** en un PR, los commits del rango `base..head`; en el escaneo programado y a mano,
  todo el historial. gitleaks carga `.gitleaks.toml` del repo que escanea; por eso el archivo debe
  revisarse en cada PR que lo toque.
- **Resultado 2026-10-26:** historial completo (56 commits) y árbol de trabajo: sin hallazgos con
  la configuración. Sin la excepción, el único hallazgo era el valor de prueba de
  `api/test/setup.ts`. No se encontró ningún secreto real en el repo.
- **Instalación:** el workflow baja el binario de la release `v8.24.3` y verifica su SHA-256
  antes de ejecutarlo. Se usa el binario y no `gitleaks-action`, que en una organización exige
  licencia.

## Procedimiento ante un hallazgo

### Secreto real (o que podría serlo)

1. **No** pegar el valor en un issue, PR, comentario, chat ni log. gitleaks ya lo redacta
   (`--redact`); tampoco hay que copiarlo a mano.
2. **Avisar a Miguel de inmediato.**
3. **Tratarlo como comprometido**, aunque el repo sea privado, y **rotarlo en su origen**. Según el
   secreto:
   - `JWT_SECRETO` (firma de sesiones): cambiarlo cierra todas las sesiones. Es un cambio normal,
     con aviso a los usuarios.
   - `PIN_PIMIENTA`: **no rotar a ciegas.** Cambiarlo invalida todos los hashes de PIN (ADR 0018)
     y deja a todos los usuarios sin entrar. Requiere un plan de migración de PIN, decidido con
     Miguel.
   - `MYSQL_PASSWORD` del usuario `acceso` (base compartida, ADR 0034): rotarlo en el servidor de
     base de datos y en `/opt/acceso/.env` del CT 120.
   - `RELEASE_DEPLOY_KEY` (deploy key de `release.yml`): revocarla, generar otra y actualizar el
     secreto de GitHub Actions.
   - Tokens de GitHub o de terceros: revocarlos y generar uno nuevo.
4. **Quitarlo del árbol** en un commit nuevo. Quitarlo no basta: sigue en el historial, por eso la
   rotación es lo que de verdad cierra el riesgo. Reescribir el historial (force push) lo decide
   Miguel: develop y master están protegidas por ruleset.
5. Si era un valor de prueba sin uso real, se puede tratar como falso positivo (abajo).

### Falso positivo

Una excepción en `.gitleaks.toml`, **por valor exacto** (nunca por ruta sola), en un PR con su
motivo en `description`. Lo revisa Miguel.

## Hallazgos de CodeQL

Se revisan en la pestaña Security del repo.

- **Falso positivo:** cerrarlo como *dismissed* con el motivo.
- **Real:** PR `bugfix/...`. Un hallazgo de severidad alta o crítica en código que llega a
  producción se corrige antes del siguiente tag (ADR 0014).

## Licencias

- **Cómo:** `bin/licencias` (o `bin/licencias web`). Instala en una copia temporal con
  `npm ci --omit=dev --ignore-scripts`, de modo que no ejecuta scripts de terceros ni toca el
  `node_modules` del repo, y clasifica cada licencia de producción.
- **Lista permitida:** MIT, MIT/X11, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, Unlicense,
  CC0-1.0, BlueOak-1.0.0, Zlib, Python-2.0. Una expresión `OR` se acepta si una alternativa está
  permitida (se elige esa); `AND`, si lo están todas.
- **Cuándo:** al agregar una dependencia de producción y antes de un release mayor. No corre en CI:
  es una revisión humana. Sale con 1 si hay algo que revisar.
- **Resultado 2026-10-26:**
  - `api`: 83 paquetes de producción, todos permisivos (MIT, ISC, BSD-3-Clause, Apache-2.0).
  - `web`: 324 paquetes. `jszip@3.10.2` es `MIT OR GPL-3.0-or-later`; se usa bajo MIT. **Pendiente:**
    `buffers@0.1.1` no declara licencia (ni campo ni texto en su README). Llega vía
    `exceljs` → `unzipper` → `binary`. Hay que leer su LICENSE en el repositorio de origen antes de
    darlo por bueno.
- **Lo que no cubre:** licencias de Flutter/pub, de las librerías de PlatformIO y de las imágenes
  base de Docker.

## Pendientes y prerrequisitos

- Instalar `seguridad.yml` (ver `docs/ci/propuestos/README.md`).
- GitHub Advanced Security, *Secret scanning* y *Push protection* en el repo; *Dependabot security
  updates* en la configuración del repo. Ninguno se ve desde un workflow.
- Decidir si los checks de seguridad pasan a `needs` de `ci` (bloqueantes).
- Dependabot para `pub` (`/app`) cuando haya una auditoría de Dart que lo acompañe.
- Fijar por SHA las acciones de `ci.yml`, `release.yml` y `deploy.yml`, que hoy usan tags
  (`@v7`). Es un cambio aparte.
- Escaneo de imágenes Docker y de las imágenes base.
- CodeQL para el firmware (C/C++) y revisión de cobertura de Dart.
