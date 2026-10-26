# 17 — `cuenta_datos_empresa`

**Módulo dueño:** `seguridad` · **Tenant:** sí · **Migración:** `db/migrations/20261012100004_create_cuenta_datos_empresa.sql` y `20261021100001_ajusta_cuenta_datos_empresa.sql`

## Propósito

Datos de la empresa cliente que el equipo AGROCOM captura al crear la cuenta (web admin, A04a y A05a). Uno por cuenta. La razón social es `cuentas.nombre`.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `nit` | `VARCHAR(20)` | sí | NIT de la empresa (opcional) |
| `ciudad` | `VARCHAR(80)` | no |  |
| `contacto_nombre` | `VARCHAR(120)` | no | Nombre del contacto de facturación |
| `contacto_apellido` | `VARCHAR(120)` | no | Apellido del contacto; `''` en las filas anteriores a la migración |
| `contacto_telefono` | `VARCHAR(30)` | sí | Opcional |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_cuenta_datos_empresa_cuenta`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Una sola fila vigente por cuenta.

## Dudas

- El diseño también pide correo y teléfono del administrador inicial (opcionales): `usuarios` no tiene dónde guardarlos. Ver `TODO(docs)` en el panel.
