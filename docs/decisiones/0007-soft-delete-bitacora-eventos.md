# ADR 0007 — Soft delete, autoría, bitácora de cambios y eventos de acceso

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0007 de ACRECIA, más el registro de accesos propio de este proyecto.

## Contexto

En control de acceso, la pregunta "¿quién entró, por qué puerta y quién le dio permiso?" tiene que poder responderse siempre, incluso sobre personas, reglas o puertas que ya se dieron de baja. Un `DELETE` físico o un cambio sin registro rompe esa trazabilidad.

## Decisión

1. **Soft delete por defecto** en toda tabla de dominio: `deleted_at` + autoría `created_by`, `updated_by`, `deleted_by`. Ningún `DELETE` físico salvo excepción documentada en el PR.
2. **Autoría automática**: la completa `RepositorioDeCuenta`/`RepositorioDePlataforma` desde `ContextoCuenta`. Ninguna acción tiene que acordarse.
3. **Bitácora de cambios** (`bitacoras`, solo inserción): actor, cuenta, tabla, registro, acción (`creado`, `actualizado`, `eliminado`, `restaurado`), origen (`api`, `dispositivo`, `sistema`) y valores antes/después **sin** columnas sensibles (hashes, secretos). La escribe el repositorio base en la **misma transacción** que el cambio.
4. **Eventos de acceso** (`eventos_acceso`, solo inserción): cada intento de apertura, aceptado o rechazado, con puerta, dispositivo, persona/credencial (si se identificó), resultado, `motivo_code`, hora del servidor y hora del dispositivo. También la apertura por pulsador de salida y "puerta forzada" cuando el sensor lo detecte.
5. **Desactivar no es eliminar**: `activo = 0` saca un registro de uso pero lo deja visible y reactivable; eliminar (soft delete) lo saca de los listados.

## Alternativas descartadas

- **Auditoría por triggers de MySQL**: no conocen al usuario de la aplicación ni el origen sin trucos de variables de sesión.
- **Bitácora llamada desde cada acción**: depende de que cada implementación se acuerde.

## Consecuencias

- En producción, el usuario de base de la API no tiene `UPDATE` ni `DELETE` sobre `bitacoras` ni `eventos_acceso`.
- `eventos_acceso` crece rápido: índice por `(tenant_id, puerta_id, ocurrido_at)` y política de retención a definir (duda D-06).
