---
name: flujo-git-pr
description: Cómo se integra el trabajo en AGROCOM Acceso — ramas GitFlow simplificado, mensajes de commit en español, PR contra develop, el auto-merge que integra solo cuando CI está en verde y el release por tag. Usar antes de crear una rama, commitear o abrir un PR.
---

# Flujo de integración — AGROCOM Acceso

GitFlow simplificado (ADR 0006) con release por tag (ADR 0014). Monorepo: una rama puede tocar `api/`, `app/`, `firmware/` y `db/` a la vez (ADR 0001). La versión operativa está en `CONTRIBUTING.md`; esto es lo que hay que tener presente al trabajar.

## Ramas

- **`master`**: última versión publicada. Nunca recibe PR ni commits: la mueve `release.yml` al pushear un tag `vX.Y.Z`.
- **`develop`**: integración. Toda `feature/*` y `bugfix/*` entra acá por PR.
- **`feature/<nombre-corto>`**: una por HU o tarea técnica. Nace de `develop`.
- **`bugfix/<nombre-corto>`**: corrección sin urgencia; mismo camino que una feature.
- **`fix/<nombre-corto>`**: corrección urgente sobre lo publicado; nace de `master` y se publica con un tag sobre la propia rama.

**Nombres de 2–3 palabras, de la función del proyecto**: `feature/qr-dinamico`, `feature/alta-dispositivo`. Nunca de la actividad ni del número de tarea (`feature/implementar-tests`, `feature/tarea-09`).

## Un PR = una HU

La unidad de entrega es la historia o tarea técnica completa, con sus criterios de aceptación cubiertos. Mientras se trabaja sobre el mismo objetivo se suman commits a la misma rama y al mismo PR; un PR nuevo se abre cuando cambia el objetivo. Vale abrirlo a mitad de camino **en borrador**: el auto-merge se saltea los borradores.

## Mensajes de commit

En español, imperativo, sin punto final:

```
agrega la validación de QR en la API
corrige el tiempo de apertura del relé
```

**Sin trailer `Co-Authored-By` ni ninguna otra atribución, tampoco en los PR.** `.claude/settings.json` declara `"includeCoAuthoredBy": false` para que el harness no lo agregue. Ningún subagente commitea por su cuenta.

## El merge está automatizado

`.github/workflows/auto-merge.yml` integra el PR con squash (y borra la rama) en cuanto el check `ci` de `ci.yml` queda verde (`ci` resume los jobs `api`, `app` y `firmware`; una parte que no existe o no cambió se saltea). No usa el auto-merge nativo de GitHub (no disponible en repos privados del plan Free): espera los check-runs por SHA y mergea con `gh pr merge --squash`.

- Abrir un PR listo equivale a decidir que entra a `develop`.
- El PR tiene que apuntar a **`develop`**: `ci.yml` solo corre en PR hacia `develop`/`master`. Un PR con otra base no dispara la CI y el auto-merge espera en vano.
- `pull_request` no corre si el PR tiene conflictos: rebasa sobre `develop` y vuelve a pushear.
- Al marcar *Ready for review* corre el auto-merge, pero no la CI: si la CI no había corrido sobre ese SHA, empuja un commit o cierra y reabre el PR.

## Publicar una versión

```
git checkout develop && git pull
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

## Guardarraíles activos

`.claude/hooks/guardarrail-bash.sh` deniega, incluso en modos permisivos: push directo a `master`/`develop`, `push --force` (sí permite `--force-with-lease`), `reset --hard`, `clean -fdx`, `branch -D`, commits sobre `master` (y pide confirmación sobre `develop`), `dbmate drop`/`rollback` y `DROP`/`TRUNCATE` sueltos, `docker compose down -v` (salvo sobre un proyecto `-p <nombre>-verif`) la lectura o escritura del `.env` real y de los secretos del firmware y de Android; pide confirmación antes de borrar la flash del ESP32. Si tocas ese hook, corre `.claude/hooks/prueba-guardarrail.sh`.

## Antes de pushear

`./bin/verify` en verde — ver el skill [verificacion].
