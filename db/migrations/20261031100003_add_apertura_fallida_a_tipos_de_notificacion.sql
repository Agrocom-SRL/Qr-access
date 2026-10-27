-- migrate:up
-- Nuevo tipo de aviso de la bandeja: `apertura.fallida` (ADR 0031 §18): la puerta recibió la orden de abrir y no se
-- abrió, varias veces seguidas. Se agrega a la lista cerrada del `CHECK` de `notificaciones.tipo`.
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida'
  ));

-- migrate:down
-- Antes de volver a la lista corta se retiran las filas del tipo nuevo (una constraint no puede validar contra ellas).
DELETE FROM notificaciones WHERE tipo = 'apertura.fallida';
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada'
  ));
