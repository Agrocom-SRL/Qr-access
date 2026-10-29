-- migrate:up
-- La habilita el administrador de la cuenta, por puerta (ADR 0035 §5). Las puertas nuevas toman
-- `cuentas.apertura_manual_por_omision`. La disponibilidad real exige además al menos una placa en servicio en la
-- puerta; eso lo calcula la API, no la columna.
ALTER TABLE puertas
  ADD COLUMN apertura_manual TINYINT(1) NOT NULL DEFAULT 1 AFTER activo;

-- migrate:down
ALTER TABLE puertas
  DROP COLUMN apertura_manual;
