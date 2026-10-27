-- migrate:up
-- Estado de la placa derivado del latido (ADR 0031 §18). Lo escriben el latido (`en_linea_desde`,
-- `lector_responde`, `lector_cambio_at`) y el detector periódico (`estado_conexion`, `estado_lector`,
-- `en_observacion`); todo es telemetría derivada y no pasa por la bitácora.
-- - `estado_conexion`: `en_linea`, `sin_conexion`, `caida_sostenida` (15 min sin latido) o `desaparecida` (2 h).
--   NULL = nunca envió un latido (no genera aviso).
-- - `en_linea_desde`: desde cuándo la racha actual de latidos es continua; la recuperación exige una racha
--   sostenida (histéresis) para que un latido suelto no cierre un aviso y lo vuelva a abrir.
-- - `lector_responde`: lo que informó el último latido sobre el lector QR (NULL = el firmware no lo informa);
--   `lector_cambio_at`, desde cuándo informa ese valor; `estado_lector`: `responde` o `sin_respuesta`.
--   `lector_informado_at`: cuándo fue la última vez que un latido informó el lector. Si la placa sigue latiendo
--   horas sin informarlo (firmware que dejó de hacerlo), el detector lo da por obsoleto y lo vuelve a NULL.
-- - `en_observacion`: en línea pero sin lecturas en la puerta por el umbral (marca informativa, sin aviso).
ALTER TABLE dispositivos
  ADD COLUMN estado_conexion VARCHAR(20) NULL AFTER ultima_puerta_abierta,
  ADD COLUMN en_linea_desde DATETIME(3) NULL AFTER estado_conexion,
  ADD COLUMN lector_responde TINYINT(1) NULL AFTER en_linea_desde,
  ADD COLUMN lector_cambio_at DATETIME(3) NULL AFTER lector_responde,
  ADD COLUMN lector_informado_at DATETIME(3) NULL AFTER lector_cambio_at,
  ADD COLUMN estado_lector VARCHAR(20) NULL AFTER lector_informado_at,
  ADD COLUMN en_observacion TINYINT(1) NOT NULL DEFAULT 0 AFTER estado_lector,
  ADD CONSTRAINT ck_dispositivos_estado_conexion CHECK (
    estado_conexion IS NULL OR estado_conexion IN ('en_linea', 'sin_conexion', 'caida_sostenida', 'desaparecida')
  ),
  ADD CONSTRAINT ck_dispositivos_estado_lector CHECK (
    estado_lector IS NULL OR estado_lector IN ('responde', 'sin_respuesta')
  );

-- migrate:down
ALTER TABLE dispositivos
  DROP CONSTRAINT ck_dispositivos_estado_lector,
  DROP CONSTRAINT ck_dispositivos_estado_conexion,
  DROP COLUMN en_observacion,
  DROP COLUMN estado_lector,
  DROP COLUMN lector_informado_at,
  DROP COLUMN lector_cambio_at,
  DROP COLUMN lector_responde,
  DROP COLUMN en_linea_desde,
  DROP COLUMN estado_conexion;
