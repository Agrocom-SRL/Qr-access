---
name: backend-node
description: Mapa del backend de AGROCOM Acceso (Node 22 + TypeScript + Fastify + mysql2, sin ORM) — dónde va una ruta, una acción, un repositorio, un contrato o un evento; las piezas de plataforma (ContextoCuenta, RepositorioDeCuenta, bitácora, errores) y las reglas de capas. Usar antes de escribir código de la API.
---

# Backend — mapa de `api/`

Decisiones: ADR 0002 (stack), 0003 (módulos), 0004 (seguridad), 0005 (API), 0007 (bitácora), 0019 (composición del arranque).

## Estructura

```
api/
  src/
    server.ts                 el proceso: config, pool, señales y escuchar el puerto (nada más)
    app.ts                    construirApp({ config, pool }): solo compone, en orden
                              crearServidor → plugins → plataforma (salud) → módulos
    modulos.ts                EL registro de módulos: lista { nombre, rutas } + los autenticadores
    config.ts                 variables de entorno validadas con zod (falla al arrancar si falta una)
    platform/                 transversal, en inglés
      http/                   crear-servidor.ts (Fastify, logger, límite de body, zod, errores),
                              constantes.ts (PREFIJO_API, LIMITE_BODY_BYTES), paginacion.ts, dependencias.ts
      db/
        pool.ts               pool de mysql2/promise (namedPlaceholders: false, timezone 'Z', decimalNumbers: false)
        transaccion.ts        enTransaccion(pool, fn): conexión del pool + BEGIN/COMMIT/ROLLBACK
        repositorio-base.ts   la mecánica: SELECT/INSERT/UPDATE/soft delete con `?`, autoría y bitácora
        repositorio-de-cuenta.ts   base de toda tabla con tenant_id (filtra por la cuenta del contexto)
        repositorio-de-plataforma.ts  tablas sin tenant y SALTO EXPLÍCITO del aislamiento (solo lectura de tablas de cuenta)
      contexto/
        contexto-cuenta.ts    AsyncLocalStorage: { cuentaId, usuarioId, rolActivoId, dispositivoId, origen }
      bitacora/               registrarCambio(tx, …) — solo lo llama el repositorio base
      errores/                ErrorDeDominio(code, status, extra) + RFC 9457
      seguridad/              principal.ts (tipos), hash.ts (argon2id), tokens.ts (SHA-256, HMAC), jwt.ts, limitador-de-intentos.ts
      tiempo/                 fechas.ts (ISO UTC)
    plugins/                  un archivo por plugin Fastify, `registrar<Nombre>(app)`: openapi, autenticacion, permisos
    modules/                  un módulo por funcionalidad, en español
      seguridad/              cuentas, usuarios (PIN), roles, permisos, sesiones
      suscripciones/          planes, suscripciones y vigencia (ADR 0017); solo `contracts.ts`, sin rutas
      organizacion/           sitios, puertas
      accesos/                QR (emitir, listar, anular), validación, eventos
      dispositivos/           autenticación, latido, configuración
  test/                       Vitest: helpers (reiniciarBase, crearEscenario, iniciarSesion…), un archivo por regla
  .dependency-cruiser.cjs     fronteras entre módulos
```

## Dentro de un módulo

| Archivo | Qué contiene | Quién lo importa |
|---|---|---|
| `routes.ts` | `export function rutas(deps)` → plugin Fastify con `schema` (zod), `config: { acceso }` y `preHandler: permiso('accesos.puerta.editar')` | Solo `modulos.ts` |
| `schemas.ts` | Esquemas zod de request/response (fuente del OpenAPI) | El propio módulo |
| `actions/<verbo-objeto>.ts` | `export async function ejecutar(datos): Promise<Resultado>` — un caso de uso | Las rutas del módulo |
| `repository.ts` | SQL a mano sobre las tablas **de este módulo** (extiende `RepositorioDeCuenta`) | Las acciones del módulo |
| `domain/` | Funciones puras (p. ej. `evaluarHorario`, `verificarFirmaQr`) — sin base ni red | El módulo; se prueban sin MySQL |
| `contracts.ts` | **Superficie pública**: interfaces y DTOs que otros módulos pueden usar | Otros módulos |
| `events.ts` | **Superficie pública**: eventos que el módulo emite (con ids, nunca filas) | Otros módulos |

Agregar un módulo (ADR 0019) = su carpeta + **una línea** en `src/modulos.ts`. `app.ts` no se toca. La regla `solo-app-registra-rutas` de dependency-cruiser deja importar `routes.ts` solo a `app.ts` y `modulos.ts`.

Reglas:
1. **Un dueño por tabla**: solo el repositorio del módulo dueño la escribe.
2. **Entre módulos, solo `contracts.ts` y `events.ts`** — lo verifica dependency-cruiser.
3. Las rutas no tienen lógica: validan, autorizan, llaman `ejecutar` y devuelven.
4. `domain/` es puro: así la validación de QR y los horarios se prueban con casos escritos a mano.

## SQL a mano

```ts
// repository.ts — cada tabla se declara una vez; los textos del SQL son constantes, los valores van en params
export class RepositorioDePuertas extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, { nombre: 'puertas', columnas: ['sitio_id', 'nombre', 'activo'], perfil: 'dominio', deCuenta: true });
  }

  buscarPorNombre(nombre: string): Promise<PuertaFila[]> {
    return this.seleccionar<PuertaFila>({
      columnas: 't.id, t.nombre, s.nombre AS sitio_nombre',
      uniones: 'JOIN sitios AS s ON s.id = t.sitio_id AND s.tenant_id = t.tenant_id AND s.deleted_at IS NULL',
      donde: 't.nombre LIKE ?',
      params: [`%${nombre}%`],
      orden: 't.nombre',
    });
  }
}
```

- `seleccionar` / `seleccionarUna` / `contar` / `insertar(tx, …)` / `actualizar(tx, id, cambios, { cuando })` / `borrar(tx, id)` **agregan solos** `tenant_id = ?` y `deleted_at IS NULL`, completan `created_by`/`updated_by`/`deleted_by` y escriben la bitácora con valores antes/después en la misma transacción. La tabla es el alias `t`; toda unión a otra tabla de cuenta lleva también `s.tenant_id = t.tenant_id`.
- `perfil`: `dominio` (soft delete + autoría + bitácora), `dominio_sin_bitacora` (pivotes), `transitoria` (sesiones) y `solo_insercion` (`eventos_acceso`: `actualizar` y `borrar` lanzan). `sensibles` lista las columnas que nunca van a la bitácora. Las claves de un objeto a escribir se validan contra `columnas` (lista blanca).
- `actualizar(..., { cuando })` lee la fila con `FOR UPDATE` y aplica el `UPDATE` con la condición extra: es el compare-and-set del consumo de un QR (`usado_at IS NULL AND …`); devuelve `false` si no afectó la fila.
- `RepositorioDePlataforma` es el salto EXPLÍCITO: lee sin filtro de cuenta (login por código, refresh por hash, credencial de dispositivo) y nunca escribe una tabla de cuenta. Cada uso se justifica en el PR.
- Columnas dinámicas (orden, filtros) solo desde una lista blanca: `ORDENABLES = { nombre: 'p.nombre', creado: 'p.created_at' } as const`.
- `BIGINT` llega como string (`supportBigNumbers` + `bigNumberStrings`); `DECIMAL` también: no se convierte a `number` para operar dinero.
- Sin contexto de cuenta, `RepositorioDeCuenta` lanza `SinContextoDeCuenta` (falla cerrado). Para procesos de sistema: `ContextoCuenta.ejecutarEn(cuentaId, fn)`.

## Errores

`throw new ErrorDeDominio('qr.vencido', 422)` → `{"type":"…/errores/qr.vencido","title":"qr.vencido","status":422,"code":"qr.vencido"}`. La app traduce el `code`. Nunca un texto en español en la API.

## Tests (Vitest)

- Contra MySQL `qr_access_testing`, ya migrada (`bin/verify api` corre dbmate antes; `test/global-setup.ts` falla con el comando exacto si faltan migraciones). Cada archivo llama `reiniciarBase(pool)` en `beforeEach` (trunca y recarga `db/seeds/01_catalogo.sql`; verifica el sufijo `_testing`).
- Datos de prueba con `test/helpers/fixtures.ts` (SQL directo, no la API): `crearEscenario(pool, 'AAA')` arma cuenta, roles, usuarios con PIN, suscripción, sitio, dos puertas y dos dispositivos.
- Las rutas que un test registra a mano deben declarar `config: { acceso: 'publica' }`: sin declarar, exigen un usuario (se falla cerrado).
- `app.inject()` de Fastify, sin levantar puerto.
- Obligatorios: aislamiento (A pide recurso de B → 404) en todo endpoint con datos de cuenta; QR vencido, reusado, de otra cuenta y fuera de horario → rechazado y registrado.
