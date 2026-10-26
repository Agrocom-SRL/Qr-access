-- migrate:up
-- Ventana de repetición y registro sin ruido (ADR 0032 §3 y §4). `repetido_de_id` apunta al primer
-- intento (el original) cuando el MISMO dispositivo repite el MISMO token dentro de la ventana.
-- La tabla es de solo inserción: la columna se escribe en el INSERT de la fila repetida; ninguna
-- fila se actualiza (invariante 4, ADR 0007). Un original tiene `repetido_de_id` NULL, y un
-- repetido nunca apunta a otro repetido (siempre al original), así la ventana no se encadena.
ALTER TABLE eventos_acceso
  ADD COLUMN repetido_de_id BIGINT UNSIGNED NULL AFTER leido_en_dispositivo_at,
  ADD KEY idx_eventos_acceso_repeticion (tenant_id, dispositivo_id, token_hash, ocurrido_at),
  ADD KEY idx_eventos_acceso_repetido_de (repetido_de_id),
  ADD CONSTRAINT fk_eventos_acceso_repetido_de FOREIGN KEY (repetido_de_id) REFERENCES eventos_acceso (id);

-- migrate:down
ALTER TABLE eventos_acceso
  DROP FOREIGN KEY fk_eventos_acceso_repetido_de,
  DROP KEY idx_eventos_acceso_repetido_de,
  DROP KEY idx_eventos_acceso_repeticion,
  DROP COLUMN repetido_de_id;
