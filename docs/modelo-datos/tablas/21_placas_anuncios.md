# 21 — `placas_anuncios`

**Módulo dueño:** `dispositivos` · **Tenant:** no · **Migración:** `db/migrations/20261014100001_placas_por_anuncio.sql` (ADR 0026) · **Perfil:** transitoria (como `sesiones`: se marca, no se borra)

## Propósito

Los candidatos de una placa: cada pareja `(mac, clave)` que se anuncia. La MAC es pública y el anuncio es anónimo, así que junto a la placa real puede haber candidatos falsos. El único que se vuelve dispositivo es el que llega a `POST /dispositivos/confirmar`, o sea el de la placa a la que alguien le mantuvo pulsado el botón.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `placa_id` | `BIGINT UNSIGNED` | no | FK a `placas` |
| `clave_huella` | `CHAR(64)` | no | SHA-256 de la clave (256 bits aleatorios, no adivinable); reconoce al candidato sin gastar un argon2id en una ruta anónima |
| `firmware_version`, `ip`, `ultimo_anuncio_at` | | | Telemetría del último anuncio de ese candidato |
| `descartada_at` | `DATETIME(3)` | sí | Se marca en todos los candidatos al confirmarse uno |
| `created_at`, `updated_at` | `DATETIME(3)` | no | |

## Índices y reglas

- `uq_placas_anuncios_clave (placa_id, clave_huella)`.
- Hasta 5 candidatos vivos por placa; más es `429`.
- Un candidato descartado ya no sirve para anunciarse ni para confirmar.
