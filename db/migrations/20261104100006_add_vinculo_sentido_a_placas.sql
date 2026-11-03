-- migrate:up
-- La solicitud de vínculo del super admin también lleva la ubicación del lector de la placa (ADR 0035 §4):
-- `entrada` (lado de afuera), `salida` (lado de adentro) o `ambos` (una sola placa). Nulo = `ambos`, así las
-- solicitudes en curso y las placas actuales no cambian. Se pasa a `dispositivos.sentido` al confirmar.
ALTER TABLE placas
  ADD COLUMN vinculo_sentido VARCHAR(10) NULL AFTER vinculo_nombre,
  ADD CONSTRAINT ck_placas_vinculo_sentido CHECK (vinculo_sentido IS NULL OR vinculo_sentido IN ('entrada', 'salida', 'ambos'));

-- migrate:down
ALTER TABLE placas
  DROP CONSTRAINT ck_placas_vinculo_sentido,
  DROP COLUMN vinculo_sentido;
