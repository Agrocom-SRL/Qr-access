-- migrate:up
-- Sesiones por instalación y plataforma (ADR 0030 §4.1, ola W8). Iniciar sesión en varios aparatos nunca se
-- bloquea; estos datos sirven para listar los dispositivos conectados, cerrar sesiones y, más adelante, detectar
-- patrones. Privacidad: ninguna columna identifica el aparato ni a la persona.
--  - `instalacion_id`: identificador ALEATORIO que la app genera y guarda localmente; no es el IMEI, el
--    identificador de publicidad ni ninguna huella del aparato. Se borra al reinstalar. Nunca se muestra.
--  - `plataforma`: android, ios o web.
--  - `nombre_dispositivo`: nombre corto que manda la app (modelo del aparato o navegador); texto libre acotado.
--  - `ultima_actividad_at`: la última petición autenticada o refresco (se actualiza como mucho cada 5 minutos).
--  - `motivo_cierre` y `revocada_por`: por qué y quién cerró la sesión (NULL = cierres anteriores a esta ola o
--    por PIN regenerado, baja o suspensión).
-- Las sesiones que ya existen quedan con instalación y plataforma NULL: siguen sirviendo y se cuentan solo contra
-- el tope por usuario.
ALTER TABLE sesiones
  ADD COLUMN instalacion_id VARCHAR(64) NULL AFTER ip,
  ADD COLUMN plataforma VARCHAR(10) NULL AFTER instalacion_id,
  ADD COLUMN nombre_dispositivo VARCHAR(60) NULL AFTER plataforma,
  ADD COLUMN ultima_actividad_at DATETIME(3) NULL AFTER nombre_dispositivo,
  ADD COLUMN motivo_cierre VARCHAR(24) NULL AFTER revocada_at,
  ADD COLUMN revocada_por BIGINT UNSIGNED NULL AFTER motivo_cierre,
  ADD CONSTRAINT ck_sesiones_plataforma CHECK (plataforma IS NULL OR plataforma IN ('android', 'ios', 'web')),
  ADD CONSTRAINT ck_sesiones_motivo_cierre CHECK (motivo_cierre IS NULL OR motivo_cierre IN
    ('salida', 'propia', 'superior', 'plataforma', 'misma_instalacion', 'limite_usuario', 'limite_instalacion')),
  ADD CONSTRAINT fk_sesiones_revocada_por FOREIGN KEY (revocada_por) REFERENCES usuarios (id),
  ADD KEY idx_sesiones_instalacion (instalacion_id, revocada_at),
  ADD KEY idx_sesiones_vivas (usuario_id, revocada_at, expira_at);

UPDATE sesiones SET ultima_actividad_at = created_at WHERE ultima_actividad_at IS NULL;

-- migrate:down
ALTER TABLE sesiones
  DROP KEY idx_sesiones_vivas,
  DROP KEY idx_sesiones_instalacion,
  DROP FOREIGN KEY fk_sesiones_revocada_por,
  DROP CONSTRAINT ck_sesiones_motivo_cierre,
  DROP CONSTRAINT ck_sesiones_plataforma,
  DROP COLUMN revocada_por,
  DROP COLUMN motivo_cierre,
  DROP COLUMN ultima_actividad_at,
  DROP COLUMN nombre_dispositivo,
  DROP COLUMN plataforma,
  DROP COLUMN instalacion_id;
