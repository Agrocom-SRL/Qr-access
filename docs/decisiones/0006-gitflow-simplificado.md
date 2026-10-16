# ADR 0006 — Branching: GitFlow simplificado

**Estado:** Aceptada (2026-10-08), complementada por ADR 0014 (master solo por tag) · **Origen:** ADR 0006 de ACRECIA.

## Contexto

AGROCOM Acceso lo desarrolla un equipo chico con agentes de IA como implementadores. El GitFlow clásico (master + develop + feature/\* + release/\* + hotfix/\*) está pensado para coordinar equipos con ciclos de release formales; acá `release/*` y `hotfix/*` agregan ceremonia sin nadie a quien coordinar. Al mismo tiempo, trunk-based puro pierde la separación entre "lo que ya está integrado" y "lo que ya está publicado", que sigue siendo útil porque las puertas instaladas y la app publicada usan la versión publicada, no lo que esté a medio integrar.

## Decisión

**GitFlow simplificado**:

- **`master`**: última versión publicada. Solo la mueve un tag de versión (ADR 0014).
- **`develop`**: rama de integración. Todas las `feature/*` se integran acá primero.
- **`feature/*`**: una por historia de usuario o tarea técnica; nace de `develop` y muere integrada en `develop` por PR.
- **`bugfix/*`**: corrección no urgente; mismo camino que una `feature/*`.
- **`fix/*`**: corrección urgente; nace de `master` y se publica con un tag sobre la propia rama, que la integra en `master` y la reincorpora en `develop`.
- **Sin `release/*` ni `hotfix/*` formales.**
- **Todo por Pull Request**: el PR es el punto en el que el desarrollador y el agente de IA revisan el diff antes de integrar — no es una formalidad, es el mecanismo de control de calidad.
- **Merge automatizado sin el "Enable auto-merge" nativo de GitHub**: esa característica requiere repositorio público en el plan Free, y este repo es privado. `.github/workflows/auto-merge.yml` espera a que los checks requeridos terminen e integra por `gh pr merge` — mismo resultado, sin depender del plan de la organización.
- **Commits en español, imperativo**, sin trailer `Co-Authored-By` ni otra atribución.

## Alternativas descartadas

- **Trunk-based puro**: sin `develop`, pierde la frontera entre integrado y publicado.
- **GitFlow completo** (con `release/*` y `hotfix/*`): ceremonia de coordinación que no aporta valor con un equipo chico.

## Consecuencias

- `develop` nace de `master` con el commit inicial; el kit de procesos y los esqueletos de `api/`, `app/` y `firmware/` se integran en `develop` por PR.
- `master` recibe el primer contenido recién con el primer tag `vX.Y.Z`.
