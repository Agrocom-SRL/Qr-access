# 34 — `resoluciones_de_incidente`

**Módulo dueño:** `incidentes` · **Tenant:** sí · **Migración:** `db/migrations/20261101100002_create_resoluciones_de_incidente.sql`

## Propósito

Lo que decidió quien administra la rama sobre un incidente (ADR 0033 §4.2): **descartado** (falso positivo), **confirmado** o **pendiente**. El incidente no se toca: cada decisión es una fila NUEVA y la vigente es la de mayor `id`, así queda el historial completo (pendiente, confirmado, descartado...). De solo inserción.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `incidente_id` | `BIGINT UNSIGNED` | no | FK a `incidentes_uso` |
| `resultado` | `VARCHAR(12)` | no | `descartado`, `confirmado`, `pendiente` |
| `motivo` | `VARCHAR(200)` | sí | Obligatorio al confirmar (`ck_resoluciones_de_incidente_motivo` además de la API) |
| `resuelto_por` | `BIGINT UNSIGNED` | no | FK a `usuarios`: siempre una persona; el sistema nunca resuelve |
| `resuelta_at` | `DATETIME(3)` | no | Cuándo (UTC) |

Perfil `solo_insercion`: sin soft delete ni bitácora.

## Índices y restricciones

- `idx_resoluciones_de_incidente_incidente (incidente_id, id)` sirve «la última decisión»; `idx_resoluciones_de_incidente_tenant`.
- `ck_resoluciones_de_incidente_resultado`, `ck_resoluciones_de_incidente_motivo` (confirmar exige motivo no vacío).

## Reglas

- `POST /api/v1/incidentes/{id}/resolucion` (`seguridad.incidente.resolver`). Nadie resuelve un incidente sobre sí mismo. Repetir el mismo resultado no agrega fila.
- **Reincidencia:** al confirmar se cuentan los incidentes del usuario cuya última resolución es `confirmado` y cuyo `ocurrido_at` cae dentro de la ventana (`incidente.reincidencia_ventana_dias`, inclusive). Se hace con los incidentes del usuario bloqueados, en la misma transacción que la fila, para que dos confirmaciones simultáneas no se oculten la reincidencia una a la otra.
- Cambiar una decisión (confirmado a descartado) es otra fila; el incidente deja de contar para la reincidencia. No deshace lo que una persona ya aplicó por la propuesta (restringir, suspender): eso se levanta con las acciones de estado.
