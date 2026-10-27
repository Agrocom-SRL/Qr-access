-- migrate:up
-- Índices para los detectores de señales (ADR 0030 §4, ola W12), que leen de TODAS las cuentas en pasadas periódicas:
-- - `eventos_acceso (ocurrido_at)`: el uso masivo, el uso imposible, el QR reenviado y el flujo atípico buscan los
--   intentos de una ventana de tiempo sin saber la cuenta (los índices existentes empiezan por `tenant_id`). Una sola
--   columna: la tabla recibe una escritura por lectura de placa y cada índice cuesta, así que no se agregan más. Va con
--   `ALGORITHM=INPLACE, LOCK=NONE` (si MariaDB no puede cumplirlo, el paso FALLA en vez de bloquear las escrituras de
--   la placa; ver docs/gestion/despliegue.md, «Migraciones que tocan tablas grandes»).
-- - `eventos_de_limite (tipo, ocurrido_at)`: las marcas de la bolsa y los rechazos por tope se buscan por tipo y fecha.
-- - `sesiones (updated_at)`: una sesión activa rota su refresco (y con él `updated_at`) al usarse; sirve para
--   quedarse con las sesiones que se movieron en la ventana sin recorrer toda la tabla.
-- `lock_wait_timeout` bajo (5 s): si otra transacción larga tiene la tabla, el ALTER espera su bloqueo de metadatos
-- solo ese rato y FALLA en vez de quedarse en cola, porque mientras espera bloquea las lecturas y escrituras nuevas
-- de la tabla (la placa escribe un `eventos_acceso` por lectura). Falla y se reintenta fuera de hora pico.
SET SESSION lock_wait_timeout = 5;
ALTER TABLE eventos_acceso ADD KEY idx_eventos_acceso_global (ocurrido_at), ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE eventos_de_limite ADD KEY idx_eventos_de_limite_global (tipo, ocurrido_at), ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE sesiones ADD KEY idx_sesiones_reciente (updated_at), ALGORITHM=INPLACE, LOCK=NONE;

-- migrate:down
SET SESSION lock_wait_timeout = 5;
ALTER TABLE sesiones DROP KEY idx_sesiones_reciente, ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE eventos_de_limite DROP KEY idx_eventos_de_limite_global, ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE eventos_acceso DROP KEY idx_eventos_acceso_global, ALGORITHM=INPLACE, LOCK=NONE;
