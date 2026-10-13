-- migrate:up
-- A qué banco y cuenta de AGROCOM llegó el dinero y el comprobante que lo respalda (ADR 0024).
-- Nulos en un pago en efectivo y en los pagos anteriores a esta migración.
ALTER TABLE pagos
  ADD COLUMN banco VARCHAR(60) NULL AFTER referencia,
  ADD COLUMN cuenta_destino VARCHAR(60) NULL AFTER banco,
  ADD COLUMN comprobante_id BIGINT UNSIGNED NULL AFTER cuenta_destino,
  ADD CONSTRAINT fk_pagos_comprobante FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id);

-- migrate:down
ALTER TABLE pagos
  DROP FOREIGN KEY fk_pagos_comprobante,
  DROP COLUMN comprobante_id,
  DROP COLUMN cuenta_destino,
  DROP COLUMN banco;
