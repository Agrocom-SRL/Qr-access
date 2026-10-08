---
name: backend-node
description: Mapa del backend de AGROCOM Acceso (Node 22 + TypeScript + Fastify + mysql2, sin ORM) — dónde va una ruta, una acción, un repositorio, un contrato o un evento; las piezas de plataforma (ContextoCuenta, RepositorioDeCuenta, bitácora, errores) y las reglas de capas. Usar antes de escribir código de la API.
---

# Backend — mapa de `api/`

Decisiones: ADR 0002 (stack), 0003 (módulos), 0004 (seguridad), 0005 (API), 0007 (bitácora).

## Estructura

```
api/
  src/
    server.ts                 arranque (lee config, registra plugins y módulos)
    app.ts                    construye la instancia de Fastify (los tests la usan sin escuchar puerto)
    config.ts                 variables de entorno validadas con zod (falla al arrancar si falta una)
    platform/                 transversal, en inglés
      db/
        pool.ts               pool de mysql2/promise (namedPlaceholders: false, timezone 'Z', decimalNumbers: false)
        transaccion.ts        enTransaccion(fn): conexión del pool + BEGIN/COMMIT/ROLLBACK
        repositorio-de-cuenta.ts   base de toda tabla con tenant_id (ver abajo)
        repositorio-de-plataforma.ts  base de tablas sin tenant (catálogos, cuentas)
      contexto/
        contexto-cuenta.ts    AsyncLocalStorage: { cuentaId, usuarioId, rolActivoId, origen }
      bitacora/               registrarCambio(tx, …) — solo lo llama el repositorio base
      errores/                ErrorDeDominio(code, status, extra) + plugin RFC 9457
      seguridad/              hash (argon2id), jwt, cifrado de secretos (AES-256-GCM)
    plugins/                  plugins Fastify: autenticacion, permisos, cors, rate-limit, swagger
    modules/                  un módulo por funcionalidad, en español
      seguridad/              cuentas, usuarios, roles, permisos, sesiones
      organizacion/           sitios, puertas, personas, grupos
      accesos/                credenciales QR, reglas de acceso, invitaciones, validación, eventos
      dispositivos/           alta, credencial, latido, configuración
  test/                       Vitest: helpers (crearCuenta, loginComo…), un archivo por regla
  .dependency-cruiser.cjs     fronteras entre módulos
```

## Dentro de un módulo

| Archivo | Qué contiene | Quién lo importa |
|---|---|---|
| `routes.ts` | Rutas Fastify con `schema` (zod) y `preHandler: permiso('accesos.puerta.editar')` | Solo `app.ts` |
| `schemas.ts` | Esquemas zod de request/response (fuente del OpenAPI) | El propio módulo |
| `actions/<verbo-objeto>.ts` | `export async function ejecutar(datos): Promise<Resultado>` — un caso de uso | Las rutas del módulo |
| `repository.ts` | SQL a mano sobre las tablas **de este módulo** (extiende `RepositorioDeCuenta`) | Las acciones del módulo |
| `domain/` | Funciones puras (p. ej. `evaluarHorario`, `verificarFirmaQr`) — sin base ni red | El módulo; se prueban sin MySQL |
| `contracts.ts` | **Superficie pública**: interfaces y DTOs que otros módulos pueden usar | Otros módulos |
| `events.ts` | **Superficie pública**: eventos que el módulo emite (con ids, nunca filas) | Otros módulos |

Reglas:
1. **Un dueño por tabla**: solo el repositorio del módulo dueño la escribe.
2. **Entre módulos, solo `contracts.ts` y `events.ts`** — lo verifica dependency-cruiser.
3. Las rutas no tienen lógica: validan, autorizan, llaman `ejecutar` y devuelven.
4. `domain/` es puro: así la validación de QR y los horarios se prueban con casos escritos a mano.

## SQL a mano

```ts
// repository.ts — siempre parametrizado
const filas = await this.consultar<PuertaFila>(
  'SELECT id, nombre, sitio_id FROM puertas WHERE sitio_id = ? AND nombre LIKE ?',
  [sitioId, `%${q}%`],
);
```

- `this.consultar` / `this.insertar` / `this.actualizar` / `this.borrar` de `RepositorioDeCuenta` **agregan solos** `tenant_id = ?` y `deleted_at IS NULL`, completan `created_by`/`updated_by`/`deleted_by` y escriben la bitácora con valores antes/después en la misma transacción.
- Columnas dinámicas (orden, filtros) solo desde una lista blanca: `ORDENABLES = { nombre: 'p.nombre', creado: 'p.created_at' } as const`.
- `BIGINT` llega como string (`supportBigNumbers` + `bigNumberStrings`); `DECIMAL` también: no se convierte a `number` para operar dinero.
- Sin contexto de cuenta, `RepositorioDeCuenta` lanza `SinContextoDeCuenta` (falla cerrado). Para procesos de sistema: `ContextoCuenta.ejecutarEn(cuentaId, fn)`.

## Errores

`throw new ErrorDeDominio('qr.vencido', 422)` → `{"type":"…/errores/qr.vencido","title":"qr.vencido","status":422,"code":"qr.vencido"}`. La app traduce el `code`. Nunca un texto en español en la API.

## Tests (Vitest)

- Contra MySQL `qr_access_testing`; cada archivo trunca sus tablas en `beforeEach` con el helper (que verifica el sufijo `_testing`).
- `app.inject()` de Fastify, sin levantar puerto.
- Obligatorios: aislamiento (A pide recurso de B → 404) en todo endpoint con datos de cuenta; QR vencido, reusado, de otra cuenta y fuera de horario → rechazado y registrado.
