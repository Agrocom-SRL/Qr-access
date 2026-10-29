# 32 — `confirmaciones_apertura`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migración:** `db/migrations/20261031100001_create_confirmaciones_apertura.sql`

## Propósito

Qué pasó con una orden de abrir (ADR 0031 §18): cada fila cuelga de una lectura (`lecturas`) **permitida** y dice si la puerta de verdad se abrió. Es una fila **aparte** y de **solo inserción**: el intento no se edita (invariante 4); una confirmación tardía es otra fila.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `evento_acceso_id` | `BIGINT UNSIGNED` | no | FK a `lecturas`: el intento permitido que ordenó abrir |
| `dispositivo_id` | `BIGINT UNSIGNED` | no | FK a `dispositivos`: el que ejecutó la orden |
| `puerta_id` | `BIGINT UNSIGNED` | no | FK a `puertas` |
| `origen` | `VARCHAR(10)` | no | `placa` (la placa informó) o `servidor` (la placa no contestó a tiempo y el detector dejó constancia) |
| `resultado` | `VARCHAR(20)` | no | `ejecutada`, `fallida` o `sin_confirmacion` |
| `causa` | `VARCHAR(30)` | no | Ver la tabla de abajo (`CHECK` de pares válidos) |
| `reportado_en_dispositivo_at` | `DATETIME(3)` | sí | Hora del reloj de la placa; solo informativa |
| `registrada_at` | `DATETIME(3)` | no | Hora del servidor en que se registró (UTC) |

Sin `updated_*`, `deleted_*` ni bitácora: perfil `solo_insercion`, como `lecturas`.

> **Apertura manual (ADR 0035).** Una lectura `manual` permitida también cuelga de aquí: la placa informa el resultado de la orden con `POST /dispositivos/ordenes/{id}/resultado` y se guarda la misma fila (`ejecutada`, `fallida` o `sin_confirmacion`). Una orden `vencida` sin respuesta deja `sin_confirmacion` / `sin_respuesta` con origen `servidor`.

## Resultados y causas

| `resultado` | `causa` | Quién | Significado | Equivalente en el ADR 0031 §18 |
|---|---|---|---|---|
| `ejecutada` | `puerta_abrio` | placa | El sensor vio abrir la puerta tras el pulso | `confirmada` |
| `fallida` | `puerta_no_abrio` | placa | Se accionó el relé y el sensor no vio abrir la puerta en el plazo (trabada, cerradura o riel sin respuesta) | `no_confirmada` |
| `fallida` | `puerta_no_cerro` | placa | Se abrió pero no volvió a cerrar (la placa lo informa solo si decide esperar al cierre; el servidor no lo mide) | `no_confirmada` |
| `fallida` | `rele_no_accionado` | placa | La placa no pudo accionar el relé | `no_confirmada` |
| `sin_confirmacion` | `sin_sensor` | placa | La placa no tiene el sensor habilitado: no se sabe, no se inventa un éxito | `sin_sensor` |
| `sin_confirmacion` | `sin_respuesta` | servidor | Una placa con sensor no informó dentro del plazo | (sin equivalente: el ADR no cubre el silencio) |

## Índices y restricciones

- `uq_confirmaciones_apertura_origen (evento_acceso_id, origen)`: a lo sumo una fila de la placa y una del servidor por evento. Repetir el informe no crea otra fila (idempotencia).
- `idx_confirmaciones_apertura_reciente (tenant_id, registrada_at)`, `idx_confirmaciones_apertura_dispositivo`, `idx_confirmaciones_apertura_puerta`.
- `ck_confirmaciones_apertura_causa` (pares `resultado`/`causa`), `ck_confirmaciones_apertura_origen`, `ck_confirmaciones_apertura_servidor` (la constancia del servidor solo puede ser `sin_respuesta`).

## Reglas

- **Estado efectivo de un evento:** la fila de la placa si existe; si no, la constancia del servidor; si no hay ninguna, el evento aún no tiene ejecución (rechazo, apertura esperando informe o puerta sin sensor cuya placa no informa). Una confirmación tardía de la placa se impone a `sin_respuesta`.
- La placa solo informa de aperturas **de su propio dispositivo** y de su cuenta: cualquier otro evento es 404. Se acepta hasta 10 minutos después de la orden (supuesto W10); después, 409.
- El detector (`evaluar-aperturas-fallidas`, cada minuto) deja la constancia `sin_respuesta` para las aperturas de dispositivos con `sensor_instalado = 1` que siguen sin informe tras `apertura.plazo_confirmacion_segundos` (90 s por omisión) y miran solo las últimas 24 h. Solo juzga aperturas **por QR** (`metodo = 'qr'`) con `ocurrido_at >= dispositivos.sensor_habilitado_at`: habilitar el sensor (o un firmware que aún no informa) no fabrica fallas retroactivas. La constancia se sella con `registrada_at = ocurrido_at + plazo` (no con la hora de la pasada): si el detector estuvo caído, la ventana de juicio (60 min) no se corre.
- **Sensor habilitado + `sin_sensor`:** el informe se guarda tal cual lo dijo la placa, pero el detector lo cuenta como falla (equivale a `sin_respuesta`): una placa que no ve el contacto que debería ver no confirma nada. Las fallas de dispositivos con `sensor_instalado = 0` se ignoran.
- **Límite inherente:** `ejecutada` lo informa la propia placa con SU sensor; un sensor trabado o un firmware que miente puede reportar éxito sin que la puerta se moviera, y el servidor no tiene forma de comprobarlo.
- **Orden:** para decidir qué fallas son posteriores a la última apertura `ejecutada` se ordena por `registrada_at` (hora del servidor, no la del evento) y, a igual hora, por id del evento. Una confirmación tardía de la placa puede quedar «después» de aperturas más nuevas; es un límite conocido.
- Nunca abre nada ni cambia el evento.
- Retención: **pendiente**. Todavía no hay política de retención para `confirmaciones_apertura` (no hay borrado; el volumen es una fila por apertura de una puerta con sensor, más la constancia del servidor); debe decidirse junto con la duda D-06 de `lecturas` antes de que crezca.
