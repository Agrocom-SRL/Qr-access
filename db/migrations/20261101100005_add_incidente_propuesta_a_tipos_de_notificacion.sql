-- migrate:up
-- Nuevo tipo de la bandeja: `incidente.propuesta` (ADR 0033 §4.3, ola W11): el sistema PROPONE restringir, suspender o
-- suspender y anular los QR de un usuario reincidente; una persona decide. Se agrega a la lista cerrada del `CHECK`.
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida', 'incidente.propuesta'
  ));

-- migrate:down
-- Antes de volver a la lista corta se retiran las filas del tipo nuevo (una constraint no puede validar contra ellas).
DELETE FROM notificaciones WHERE tipo = 'incidente.propuesta';
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida'
  ));
