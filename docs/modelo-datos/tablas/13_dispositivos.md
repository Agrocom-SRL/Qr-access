# 13 — `dispositivos`

**Módulo dueño:** `dispositivos` · **Tenant:** sí · **Migraciones:** `db/migrations/20261009100013_create_dispositivos.sql`, `20261013100002_add_placa_id_a_dispositivos.sql` `20261030100003_add_estado_de_placa_a_dispositivos.sql` `20261031100002_add_sensor_y_apertura_a_dispositivos.sql` y (ADR 0035) `add_sentido_a_dispositivos`

## Propósito

Asignación de una placa (ESP32) a una puerta, con su propia credencial (invariante 5). Reasignar una placa crea otro dispositivo (ADR 0025).

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `puerta_id` | `BIGINT UNSIGNED` | no |  |
| `placa_id` | `BIGINT UNSIGNED` | sí | FK a `placas`; nulo solo en los dispositivos de desarrollo anteriores al ADR 0025 |
| `sentido` | `VARCHAR(10)` | no | `entrada`, `salida` o `ambos` (por omisión `ambos`, ADR 0035). Qué sentido sirve esta placa: el de su lector y el de las órdenes de apertura manual que recibe |
| `nombre` | `VARCHAR(100)` | no |  |
| `clave_hash` | `VARCHAR(255)` | no | argon2id de la clave del dispositivo (sensible) |
| `firmware_version` | `VARCHAR(20)` | sí |  |
| `ultimo_latido_at` | `DATETIME(3)` | sí |  |
| `ultimo_rssi` | `SMALLINT` | sí |  |
| `ultima_puerta_abierta` | `TINYINT(1)` | sí |  |
| `estado_conexion` | `VARCHAR(20)` | sí | Derivado del latido por el detector: `en_linea`, `sin_conexion`, `caida_sostenida` (15 min), `desaparecida` (2 h). Nulo = nunca latió o fuera de servicio |
| `en_linea_desde` | `DATETIME(3)` | sí | Desde cuándo la racha de latidos es continua (la recuperación exige una racha sostenida) |
| `lector_responde` | `TINYINT(1)` | sí | Lo que informó el último latido sobre el lector QR; nulo = el firmware no lo informa |
| `lector_cambio_at` | `DATETIME(3)` | sí | Desde cuándo informa ese valor |
| `lector_informado_at` | `DATETIME(3)` | sí | Última vez que un latido informó el lector. Si la placa sigue latiendo 6 h sin informarlo, el detector pone `lector_responde` y `lector_cambio_at` en NULL (dato obsoleto) |
| `estado_lector` | `VARCHAR(20)` | sí | `responde` o `sin_respuesta` (derivado) |
| `en_observacion` | `TINYINT(1)` | no | En línea pero sin lecturas en la puerta por el umbral; marca informativa, sin aviso |
| `sensor_instalado` | `TINYINT(1)` | no | **Configuración**: ¿el contacto magnético de la puerta está conectado y verificado? Por omisión 0 (sin sensor: la placa informa `sin_sensor`). Lo habilita AGROCOM (`PUT /plataforma/placas/{id}/sensor`) |
| `sensor_habilitado_at` | `DATETIME(3)` | sí | **Configuración**: instante (servidor, UTC) en que se habilitó el sensor; NULL mientras `sensor_instalado = 0`. Se fija al pasar de 0 a 1, se conserva si solo cambia la polaridad y vuelve a NULL al deshabilitarlo. El detector de aperturas fallidas solo juzga aperturas ordenadas desde este instante |
| `sensor_abierto_nivel` | `VARCHAR(5)` | no | **Configuración**: nivel del pin (`alto` o `bajo`) cuando la puerta está ABIERTA. Por omisión `alto` (el valor con que hoy compila el firmware); la polaridad real del reed está pendiente de confirmar en campo |
| `sensor_estado` | `VARCHAR(12)` | sí | Lo que informó el último latido: `abierta`, `cerrada`, `sin_sensor`; nulo = el firmware no lo informa |
| `sensor_informado_at` | `DATETIME(3)` | sí | Cuándo lo informó |
| `apertura_fallida` | `TINYINT(1)` | no | 1 mientras la puerta está en el grupo de «aperturas que fallan» (lo escribe solo el detector de aperturas, con compare-and-set) |
| `revocado_at` | `DATETIME(3)` | sí |  |
| `activo` | `TINYINT(1)` | no | Desactivar no es borrar |
| `en_servicio` | `TINYINT` | sí | Generada: 1 si no está revocado ni borrado |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` (skill `modelo-datos`) |

## Índices y restricciones

- `uq_dispositivos_puerta_sentido` `(puerta_id, sentido, en_servicio)` (ADR 0035; reemplaza a `uq_dispositivos_puerta`): una puerta tiene como máximo una placa en servicio por sentido. `ambos` es exclusivo (no convive con `entrada` ni `salida`); lo hace cumplir la acción de vincular dentro de la transacción, porque una restricción única no puede expresarlo.
- `ck_dispositivos_sentido`
- `uq_dispositivos_placa`: una placa tiene un solo dispositivo en servicio

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Credencial `Dispositivo <id>.<clave>`; `clave_hash` es argon2id y nunca va a la bitácora. La clave en claro se muestra una sola vez.
- `en_servicio` (columna generada) garantiza un solo dispositivo sin revocar ni borrar por puerta **y sentido** (una puerta lleva hasta dos placas: entrada y salida, ADR 0035). La placa de un solo sentido solo recibe órdenes de apertura manual de su sentido.
- `clave_hash` se copia de `placas.clave_hash` al vincular: la clave la genera la placa y el servidor nunca la guarda en claro.
- Revocado (`revocado_at`), inactivo o borrado: la API responde 401 y el firmware no abre.
- El latido actualiza `firmware_version`, `ultimo_latido_at`, `ultimo_rssi` y `ultima_puerta_abierta` sin pasar por la bitácora (telemetría). También guarda `en_linea_desde` y, si el firmware lo informa, `lector_responde`/`lector_informado_at` (y `lector_cambio_at` si el valor cambió). El detector periódico (`evaluar-estado-de-placas`) escribe `estado_conexion`, `estado_lector` y `en_observacion`, tampoco por la bitácora (ADR 0031 §18). El detector NO bloquea filas de `dispositivos` (son padre de las FK de las validaciones, ADR 0032 §1): lee sin bloqueo, serializa por cuenta con un `GET_LOCK` y escribe con compare-and-set (`WHERE estado_conexion <=> ? AND estado_lector <=> ? AND en_observacion = ?`); solo encola el aviso si el UPDATE afectó la fila.

- Sensor de puerta (ADR 0031 §18, W10): `sensor_instalado`, `sensor_habilitado_at` y `sensor_abierto_nivel` son configuración y SÍ pasan por la bitácora (con el antes y el después); `sensor_estado`, `sensor_informado_at` y `apertura_fallida` son telemetría y no. La placa recibe la configuración en `GET /dispositivos/configuracion`. El detector `evaluar-aperturas-fallidas` sigue el mismo patrón que el de placas (lectura sin bloqueo, `GET_LOCK` por cuenta, compare-and-set `WHERE apertura_fallida = ?`).

## Dudas

- D-02 (cerrada) — `02-dudas-y-ambiguedades.md`
