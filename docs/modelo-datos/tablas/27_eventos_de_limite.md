# 27 — `eventos_de_limite`

**Módulo dueño:** `limites` · **Tenant:** sí · **Migración:** `db/migrations/20261027100003_create_eventos_de_limite.sql`

## Propósito

Registro de **solo inserción** de lo que pasa con los topes de generación de QR (ADR 0030 §5 y §7). No son intentos de acceso (esos van a `eventos_acceso`, invariante 4). De aquí leerán la bandeja de avisos (ADR 0030 §6) y las señales de abuso (§4).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: quien generaba |
| `tipo` | `VARCHAR(40)` | no | Ver abajo (`CHECK`) |
| `valor` | `INT UNSIGNED` | sí | Cuánto llevaba al ocurrir |
| `tope` | `INT UNSIGNED` | sí | El tope que regía |
| `clave_unica` | `VARCHAR(80)` | sí | Si no es `NULL`, no se repite en la cuenta (una vez por evento y día) |
| `ocurrido_at` | `DATETIME(3)` | no | UTC |

Sin autoría ni soft delete: no se edita ni se borra.

## Tipos

| `tipo` | Cuándo |
|---|---|
| `qr.limite_diario`, `qr.limite_pendientes`, `qr.limite_propios_sin_uso` | Un rechazo 429 de la generación (cada uno deja una fila) |
| `qr.reemplazo_sin_uso` | Se reemplazó un QR propio vigente sin que se hubiera usado (de ahí se cuentan los reemplazos del día y la espera) |
| `bolsa.aviso` | La cuenta llegó al porcentaje de aviso de su bolsa mensual (`clave_unica = bolsa.aviso:aaaa-mm`, una vez al mes) |
| `bolsa.superada` | La cuenta superó su bolsa (`clave_unica = bolsa.superada:aaaa-mm-dd`, una vez al día). No corta la generación |

## Índices y restricciones

- `uq_eventos_de_limite_marca (tenant_id, clave_unica)`, `idx_eventos_de_limite_usuario`, `idx_eventos_de_limite_tipo`, `ck_eventos_de_limite_tipo`.

## Reglas

- Un rechazo se escribe en su propia transacción, después de deshacer la generación rechazada: el rastro sobrevive al rollback.
- La bandeja de notificaciones de la ola W9 (`30_notificaciones.md`) hoy solo avisa de estados de placa; avisar de estos eventos de límite (ADR 0030 §5) queda para una ola posterior. Estas filas son su fuente.
