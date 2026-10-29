-- migrate:up
-- Hasta dos placas por puerta, una por ubicación del lector (ADR 0035 §4): `entrada` (lector del lado de afuera),
-- `salida` (lado de adentro) o `ambos` (una sola placa; por omisión, así las placas actuales no cambian).
-- Dice dónde está el lector; no interviene en la apertura manual. Que `ambos` no conviva con `entrada` ni `salida`
-- lo hace cumplir la acción de vincular dentro de la transacción (una restricción única no puede expresarlo).
-- `fk_dispositivos_puerta` usa de soporte el índice viejo; el nuevo también empieza por `puerta_id`, así que en el
-- mismo ALTER la clave pasa a apoyarse en él sin quedar sin índice.
ALTER TABLE dispositivos
  ADD COLUMN sentido VARCHAR(10) NOT NULL DEFAULT 'ambos' AFTER placa_id,
  ADD CONSTRAINT ck_dispositivos_sentido CHECK (sentido IN ('entrada', 'salida', 'ambos')),
  DROP INDEX uq_dispositivos_puerta,
  ADD UNIQUE KEY uq_dispositivos_puerta_sentido (puerta_id, sentido, en_servicio);

-- migrate:down
-- Con dos placas en servicio en una misma puerta la restricción vieja no se puede volver a crear y el down FALLA
-- (falla segura: no borra ninguna placa); hay que revocar una antes de revertir.
ALTER TABLE dispositivos
  DROP INDEX uq_dispositivos_puerta_sentido,
  ADD UNIQUE KEY uq_dispositivos_puerta (puerta_id, en_servicio),
  DROP CONSTRAINT ck_dispositivos_sentido,
  DROP COLUMN sentido;
