-- migrate:up
-- Índices para los detectores de señales (ADR 0030 §4, ola W12), que leen de TODAS las cuentas en pasadas periódicas:
-- - `eventos_acceso (ocurrido_at)`: el uso masivo, el uso imposible, el QR reenviado y el flujo atípico buscan los
--   intentos de una ventana de tiempo sin saber la cuenta (los índices existentes empiezan por `tenant_id`). Una sola
--   columna: la tabla recibe una escritura por lectura de placa y cada índice cuesta, así que no se agregan más. Va con
--   `ALGORITHM=INPLACE, LOCK=NONE` (si MariaDB no puede cumplirlo, el paso FALLA en vez de bloquear las escrituras de
--   la placa; ver docs/gestion/despliegue.md).
-- - `eventos_de_limite (tipo, ocurrido_at)`: las marcas de la bolsa y los rechazos por tope se buscan por tipo y fecha.
-- - `sesiones (updated_at)`: una sesión activa rota su refresco (y con él `updated_at`) al usarse; sirve para
--   quedarse con las sesiones que se movieron en la ventana sin recorrer toda la tabla.
ALTER TABLE eventos_acceso ADD KEY idx_eventos_acceso_global (ocurrido_at), ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE eventos_de_limite ADD KEY idx_eventos_de_limite_global (tipo, ocurrido_at);
ALTER TABLE sesiones ADD KEY idx_sesiones_reciente (updated_at);

-- migrate:down
ALTER TABLE sesiones DROP KEY idx_sesiones_reciente;
ALTER TABLE eventos_de_limite DROP KEY idx_eventos_de_limite_global;
ALTER TABLE eventos_acceso DROP KEY idx_eventos_acceso_global, ALGORITHM=INPLACE, LOCK=NONE;
