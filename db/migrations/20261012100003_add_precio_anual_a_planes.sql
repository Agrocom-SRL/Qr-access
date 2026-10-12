-- migrate:up
-- Precio anual en bolivianos (web admin, A09). Solo afecta renovaciones y cambios de plan futuros.
ALTER TABLE planes
  ADD COLUMN precio_anual DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER max_vigencia_qr_horas;

-- migrate:down
ALTER TABLE planes DROP COLUMN precio_anual;
