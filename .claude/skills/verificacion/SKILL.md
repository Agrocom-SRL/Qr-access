---
name: verificacion
description: La compuerta de calidad de AGROCOM Acceso — cómo correr la cascada (bin/verify) por partes (api, app, firmware), qué significa cada etapa que falla y cómo se corrige, cómo verificar migraciones contra MySQL sin tocar la base de desarrollo y qué NO se toca para hacerla pasar. Usar antes de dar por cerrado cualquier cambio de código.
---

# Verificación — la compuerta de AGROCOM Acceso

Un cambio está terminado cuando `bin/verify` devuelve 0. No cuando "se ve bien", no cuando pasa el test que escribiste: cuando la cascada completa pasa.

## Cómo se corre

```
./bin/verify                 # todas las partes que existan
./bin/verify api             # solo la API
./bin/verify app firmware    # varias partes
```

Una parte que todavía no existe se saltea con un aviso. CI corre lo mismo, un job por parte, más el job `ci` que los resume.

## Las etapas

| Parte | Etapa | Herramienta | Cómo se corrige |
|---|---|---|---|
| api | Lint | ESLint (typescript-eslint `strict`) | Corrigiendo el código, no con `eslint-disable` |
| api | Formato | Prettier (`format:check`) | `npm --prefix api run format` |
| api | Tipos | `tsc --noEmit` (`strict: true`) | Tipando de verdad, sin `any` ni `as unknown as` |
| api | Fronteras | dependency-cruiser (`.dependency-cruiser.cjs`) | Moviendo el import a `contracts.ts`/`events.ts` del módulo dueño |
| api | Tests | Vitest contra **MySQL** (`qr_access_testing`) | Ver abajo |
| app | Formato | `dart format --set-exit-if-changed` | `dart format lib test` |
| app | Análisis | `flutter analyze --fatal-infos` (`very_good_analysis`) | Corrigiendo; sin `// ignore:` sin motivo |
| app | Tests | `flutter test` (unitarios, widgets, l10n, arquitectura) | |
| app | Build | `flutter build web --release` | Suele ser un import de plataforma (`dart:io`) en código compartido |
| firmware | Compilación | `pio run` (env `esp32`) | |
| firmware | Tests | `pio test -e native` (Unity, lógica pura de `lib/`) | |

## Los tests de la API corren sobre MySQL, nunca SQLite

El setup de Vitest fuerza `DB_DATABASE=qr_access_testing` y **aborta si la base no termina en `_testing`** (o `_testing_N` en paralelo) antes de vaciar nada. Esa guarda no se debilita: en ACRECIA una corrida directa vació la base de desarrollo por una variable de entorno que pisaba la de tests.

Si falta la base de tests en un volumen existente: ver `docs/gestion/entornos.md`.

## Migraciones nuevas: MySQL limpio, migrar, sembrar dos veces y revertir

Los tests migran desde cero, pero no prueban la siembra repetida ni el rollback con datos. Para eso, un proyecto compose descartable con otros puertos (override en el scratchpad):

```yaml
# verif-override.yml
services:
  db: { ports: !override ["3317:3306"] }
```

```
docker compose -p qr-access-verif -f docker-compose.yml -f verif-override.yml up -d db
docker compose -p qr-access-verif --profile herramientas run --rm dbmate up
# seeds dos veces: idempotencia
docker compose -p qr-access-verif --profile herramientas run --rm dbmate rollback
docker compose -p qr-access-verif down -v        # permitido: es descartable
```

## Los datos de la base de desarrollo no se borran

Lo que se cargue en el MySQL del compose de desarrollo para probar algo **se deja ahí**: el usuario lo revisa después. Nada de `dbmate drop`/`rollback`, `DROP`, `TRUNCATE`, `docker compose down -v` ni `docker volume rm` sobre esa base (el guardarraíl los deniega).

## Lo que no se hace para que la cascada pase

- **No se edita un test para que deje de fallar.** El test es el criterio de aceptación; si parece equivocado, dilo y para.
- **No se agregan `eslint-disable`, `// ignore:`, `@ts-expect-error` ni excepciones en dependency-cruiser** para silenciar un hallazgo.
- **No se marca un test como `skip`** ni se deja un `.only`.
