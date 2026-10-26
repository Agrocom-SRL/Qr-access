-- migrate:up
-- Lo que cada plan fija sobre la generación de QR (ADR 0030 §2, ADR 0031 §9): la bolsa mensual de la cuenta y
-- el máximo de puertas por QR. NULL = el plan no lo fija y rige el valor de `configuracion_limites`.
ALTER TABLE planes
  ADD COLUMN bolsa_qr_mensual INT UNSIGNED NULL AFTER max_vigencia_qr_horas,
  ADD COLUMN max_puertas_por_qr INT UNSIGNED NULL AFTER bolsa_qr_mensual,
  ADD CONSTRAINT ck_planes_bolsa_qr CHECK (bolsa_qr_mensual IS NULL OR bolsa_qr_mensual >= 1),
  ADD CONSTRAINT ck_planes_max_puertas_qr CHECK (max_puertas_por_qr IS NULL OR max_puertas_por_qr >= 1);

-- migrate:down
ALTER TABLE planes
  DROP CONSTRAINT ck_planes_max_puertas_qr,
  DROP CONSTRAINT ck_planes_bolsa_qr,
  DROP COLUMN max_puertas_por_qr,
  DROP COLUMN bolsa_qr_mensual;
