# 20 — `placas`

**Módulo dueño:** `dispositivos` · **Tenant:** no (inventario de la plataforma) · **Migración:** `db/migrations/20261013100001_create_placas.sql`

## Propósito

Inventario de controladores físicos (ESP32-ETH01) y su vinculación remota (ADR 0025). Una placa no pertenece a ninguna cuenta: lo que se asigna a una puerta es un `dispositivos` que apunta a ella.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `mac` | `CHAR(17)` | no | MAC de fábrica en mayúsculas (`AA:BB:CC:00:11:22`); identifica a la placa, no la autentica |
| `codigo_hash` | `VARCHAR(255)` | no | argon2id del código de vinculación (16 caracteres, 80 bits); es el secreto de reclamo (sensible) |
| `clave_hash` | `VARCHAR(255)` | sí | argon2id de la clave que sortea la placa; nulo hasta su primer reclamo y al liberarla (sensible) |
| `firmware_version` | `VARCHAR(20)` | sí | La informa en cada reclamo |
| `ultimo_reclamo_at` | `DATETIME(3)` | sí | Último sondeo de reclamo |
| `ultima_ip` | `VARCHAR(45)` | sí | IP del último reclamo |
| `vigente` | `TINYINT` | sí | Generada: 1 si no está borrada |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |

## Índices y restricciones

- `uq_placas_mac (mac, vigente)`: una MAC por placa vigente; tras un soft delete se puede volver a registrar.
- `ck_placas_mac`: formato de MAC en mayúsculas.

## Reglas

- Estado derivado: `de_fabrica` si no hay un `dispositivos` en servicio con su `placa_id`; `vinculada` si lo hay.
- El código y la clave nunca van a la bitácora, a un log ni a una respuesta; el código se muestra una sola vez al dar de alta la placa.
- Solo los repositorios de plataforma la tocan; el repositorio base de cuenta no la ve.
- Liberar una placa borra `clave_hash`; el historial queda en los dispositivos revocados.
