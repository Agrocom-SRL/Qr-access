-- migrate:up
-- Un dispositivo es la asignación de una placa a una puerta (ADR 0025). Reasignar una placa crea
-- otro dispositivo, así el historial de cada cuenta queda intacto. Nulo solo en los dispositivos
-- anteriores a la vinculación remota (seeds de desarrollo); los nuevos siempre llevan placa.
ALTER TABLE dispositivos
  ADD COLUMN placa_id BIGINT UNSIGNED NULL AFTER puerta_id,
  ADD CONSTRAINT fk_dispositivos_placa FOREIGN KEY (placa_id) REFERENCES placas (id),
  ADD UNIQUE KEY uq_dispositivos_placa (placa_id, en_servicio);

-- migrate:down
ALTER TABLE dispositivos
  DROP FOREIGN KEY fk_dispositivos_placa,
  DROP INDEX uq_dispositivos_placa,
  DROP COLUMN placa_id;
