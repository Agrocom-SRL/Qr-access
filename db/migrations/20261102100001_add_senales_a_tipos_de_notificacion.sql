-- migrate:up
-- Nuevos tipos de la bandeja (ADR 0030 §4 y §5, ola W12): `senal.uso` (una señal de uso sospechoso de un usuario:
-- uso masivo, uso imposible, QR reenviado o PIN compartido; el tipo exacto va en `datos`), `bolsa.aviso` (la cuenta
-- llegó al porcentaje de aviso de su bolsa mensual), `bolsa.superada` (se pasó de la bolsa; no corta nada) y
-- `flujo.atipico` (el flujo de aperturas por usuario de la cuenta está muy por encima de lo habitual). Se agregan a la
-- lista cerrada del `CHECK`.
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida', 'incidente.propuesta',
    'senal.uso', 'bolsa.aviso', 'bolsa.superada', 'flujo.atipico'
  ));

-- migrate:down
-- Antes de volver a la lista corta se retiran las filas de los tipos nuevos (una constraint no puede validar contra ellas).
DELETE FROM notificaciones WHERE tipo IN ('senal.uso', 'bolsa.aviso', 'bolsa.superada', 'flujo.atipico');
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida', 'incidente.propuesta'
  ));
