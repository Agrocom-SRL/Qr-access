# 20 — `placas`

**Módulo dueño:** `dispositivos` · **Tenant:** no (inventario de la plataforma) · **Migraciones:** `db/migrations/20261013100001_create_placas.sql` y `20261014100001_placas_por_anuncio.sql` (ADR 0026)

## Propósito

Inventario de controladores físicos (ESP32-ETH01). Las placas **se anuncian solas** (`POST /dispositivos/anunciar`) y aparecen en el panel como detectadas; no se registran a mano ni llevan código de fábrica. Una placa no pertenece a ninguna cuenta: lo que se asigna a una puerta es un `dispositivos` que apunta a ella.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `mac` | `CHAR(17)` | no | MAC de fábrica en mayúsculas (`AA:BB:CC:00:11:22`); identifica a la placa, no la autentica |
| `firmware_version` | `VARCHAR(20)` | sí | La informa en cada anuncio |
| `ultimo_anuncio_at` | `DATETIME(3)` | sí | Último anuncio |
| `ultima_ip` | `VARCHAR(45)` | sí | IP del último anuncio |
| `por_confirmar_hasta` | `DATETIME(3)` | sí | Fin de la ventana de 10 minutos en la que se espera el botón de la placa; nulo si no hay solicitud |
| `vinculo_cuenta_id`, `vinculo_puerta_id`, `vinculo_nombre`, `vinculo_sentido`, `vinculo_solicitado_por` | | sí | La solicitud del super admin (`vinculo_sentido`: ubicación del lector, nulo = `ambos`, ADR 0035); se revalidan al confirmar (sin llaves foráneas: tabla de plataforma) |
| `vigente` | `TINYINT` | sí | Generada: 1 si no está borrada |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |

## Índices y restricciones

- `uq_placas_mac (mac, vigente)`: una MAC por placa vigente; tras un soft delete se puede volver a registrar (una placa real que sigue enchufada reaparece sola).
- `ck_placas_mac`: formato de MAC en mayúsculas.

## Reglas

- Estado derivado: `vinculada` si hay un `dispositivos` en servicio con su `placa_id`; `por_confirmar` si no y `por_confirmar_hasta` está en el futuro; `detectada` en otro caso.
- La clave de la placa **no se guarda aquí**: mientras no está confirmada vive como huella en `placas_anuncios` y, al confirmarse, como argon2id en `dispositivos.clave_hash`.
- Solo los repositorios de plataforma la tocan; el repositorio base de cuenta no la ve.
- Las placas sin dispositivo en servicio que no se anuncian en 7 días se dan de baja (soft delete).
