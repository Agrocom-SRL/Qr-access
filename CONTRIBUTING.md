# Flujo de trabajo — GitFlow simplificado

El porqué está en `docs/decisiones/0006-gitflow-simplificado.md` y `0014-release-por-tag.md`. Esta es la versión operativa.

## Ramas

- **`master`**: última versión publicada. No recibe PR: solo la mueve `release.yml` al pushear un tag `vX.Y.Z` (ADR 0014).
- **`develop`**: rama de integración. Toda `feature/*` se integra acá primero, por PR.
- **`feature/<nombre-corto>`**: una por historia de usuario o tarea técnica. Nace de `develop` y muere integrada en `develop`. El nombre son 2–3 palabras de **la función del proyecto** que construye (`feature/qr-dinamico`, `feature/alta-dispositivo`), nunca de la actividad ni del número de tarea.
- **`fix/<nombre-corto>`**: corrección urgente sobre lo publicado. Nace de `master` y se publica con un tag sobre la propia rama: `release.yml` la integra en `master` y la reincorpora en `develop`.
- **`bugfix/<nombre-corto>`**: corrección que no corre prisa. Nace de `develop` y sigue el mismo camino que una `feature/*`.

No hay `release/*` ni `hotfix/*`: un equipo chico no necesita esa ceremonia.

Una rama puede tocar `api/`, `app/`, `firmware/` y `db/` a la vez: el monorepo existe justamente para que una historia que cruza las tres partes entre en un solo PR (ADR 0001).

## Flujo de una historia de usuario

```
git checkout develop
git pull
git checkout -b feature/nombre-de-la-hu
# implementar, con tests del criterio de aceptación primero
./bin/verify
git push -u origin feature/nombre-de-la-hu
# abrir PR contra develop
```

## Antes de pushear

```
./bin/verify
```

Es la misma cascada que corre CI, por partes (`api`, `app`, `firmware`), y devuelve 0 solo si todo pasa. Una parte que todavía no existe se saltea con un aviso.

El merge no es manual: `.github/workflows/auto-merge.yml` integra el PR con squash en cuanto el check `ci` queda verde. Solo atiende ramas `feature/*` y `bugfix/*` hacia `develop`. Un PR en **draft** queda excluido a propósito: es la forma de decir "esto espera revisión". Al marcarlo *Ready for review* el auto-merge corre.

## Publicar una versión

```
git checkout develop && git pull
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

`release.yml` vuelve a correr la CI sobre el commit etiquetado, lo integra en `master` con merge commit y publica el GitHub Release con los artefactos (APK, web y binario del firmware) cuando existan.

## Un PR = una HU

La unidad de entrega es la historia de usuario o la tarea técnica completa, con todos sus criterios de aceptación cubiertos. Mientras se avance sobre el mismo objetivo se suman commits a la misma rama y al mismo PR. Vale abrirlo a mitad de camino **en borrador**.

## Commits

En español, imperativo: `agrega la validación de QR en la API`, `corrige el tiempo de apertura del relé`.

**Sin trailer `Co-Authored-By`** ni ninguna otra atribución, tampoco en los PR.
