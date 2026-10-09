# ADR 0002 — Backend: Node.js + TypeScript + Fastify, SQL a mano con mysql2 (sin ORM)

**Estado:** Aceptada (2026-10-08)

## Contexto

Se pidió backend en Node con contenedores y MySQL como primera versión. El dominio es acotado (cuentas, puertas, personas, reglas, credenciales, eventos) pero crítico en seguridad: una consulta mal filtrada abre una puerta de otra empresa. El equipo **no quiere un ORM ni un query builder** (decisión explícita): quiere ver y revisar el SQL que corre.

## Decisión

| Pieza | Elección |
|---|---|
| Runtime | Node.js 22 LTS |
| Lenguaje | TypeScript `strict` |
| Framework HTTP | Fastify 5 |
| Validación y contrato | zod + `fastify-type-provider-zod` → OpenAPI con `@fastify/swagger` |
| Acceso a datos | **`mysql2/promise` con SQL escrito a mano**, siempre parametrizado, dentro de repositorios |
| Migraciones | dbmate con archivos `.sql` (ADR 0011) |
| Base de datos | MySQL 8.4 LTS |
| Tests | Vitest contra MySQL real |
| Calidad | ESLint (typescript-eslint), Prettier, dependency-cruiser |
| Hash / cripto | argon2 (contraseñas y claves de dispositivo), `node:crypto` (HMAC, AES-256-GCM) |

Reglas del SQL a mano:
1. Siempre con placeholders `?`; jamás interpolar un valor en el string.
2. Identificadores dinámicos (orden, columnas de filtro) solo desde listas blancas.
3. Toda tabla de una cuenta pasa por `RepositorioDeCuenta` (ADR 0004), que agrega `tenant_id`, el filtro de borrado, la autoría y la bitácora.
4. `BIGINT` y `DECIMAL` llegan como string (`bigNumberStrings`, `decimalNumbers: false`).

## Alternativas descartadas

- **Prisma, TypeORM, Sequelize, MikroORM**: descartados por pedido explícito; además esconden el SQL que se revisa en seguridad.
- **Knex, Kysely, Drizzle** (query builders): descartados también por pedido explícito. Kysely queda como opción si algún día se quiere tipado de consultas sin ORM.
- **NestJS**: estructura completa, pero con decoradores e inyección de dependencias que agregan ceremonia a una API chica; Fastify con módulos por carpeta alcanza (ADR 0003).
- **Express**: sin validación por esquema ni OpenAPI integrados, y más lento.

## Nota (2026-10-08): por qué no Prisma, con un caso real

En un proyecto anterior del equipo, cambiar atributos de una tabla con Prisma borró datos ya insertados. El problema no es el lenguaje de consultas: es que la herramienta **genera la migración sola** comparando el modelo con la base. Si un renombre se detecta como "borrar y crear", la herramienta lo ejecuta (`prisma db push` incluso tiene `--accept-data-loss`). Aquí las migraciones son SQL escrito a mano y revisado (dbmate, ADR 0011): ningún `DROP` llega a la base sin que alguien lo haya escrito y aprobado en un PR. Se confirma esta decisión.

## Consecuencias

- Los tipos de las filas se escriben a mano (`interface PuertaFila`), al lado del SQL que las lee.
- Más SQL que escribir, a cambio de que todo lo que toca la base se vea en el diff.
