-- migrate:up
-- La placa informa las órdenes de apertura manual que toma y decide NO ejecutar (ADR 0035 §3), en vez de callar:
-- - `ocupada`: el relé no estaba libre (validación de QR en curso o puerta ya abierta).
-- - `vencida`: el plazo de la orden se agotó antes de ejecutarla.
-- Son `resultado = 'fallida'`, pero NO son una falla de la puerta: la orden nunca llegó al relé. El detector de
-- aperturas fallidas las excluye (`esFalla()`), así que dos `ocupada` seguidas no abren el aviso `apertura.fallida`.
-- Cambiar un CHECK en MariaDB exige soltarlo y volver a crearlo; ALGORITHM=COPY reescribe la tabla.
ALTER TABLE confirmaciones_apertura
  DROP CONSTRAINT ck_confirmaciones_apertura_causa,
  ADD CONSTRAINT ck_confirmaciones_apertura_causa CHECK (
    (resultado = 'ejecutada' AND causa = 'puerta_abrio')
    OR (resultado = 'fallida' AND causa IN ('puerta_no_abrio', 'puerta_no_cerro', 'rele_no_accionado', 'ocupada', 'vencida'))
    OR (resultado = 'sin_confirmacion' AND causa IN ('sin_sensor', 'sin_respuesta'))
  ),
  ALGORITHM=COPY;

-- migrate:down
-- Falla si ya existen filas con las causas nuevas (la tabla es de solo inserción y no se borra): es esperado, el
-- `down` solo sirve en una base descartable.
ALTER TABLE confirmaciones_apertura
  DROP CONSTRAINT ck_confirmaciones_apertura_causa,
  ADD CONSTRAINT ck_confirmaciones_apertura_causa CHECK (
    (resultado = 'ejecutada' AND causa = 'puerta_abrio')
    OR (resultado = 'fallida' AND causa IN ('puerta_no_abrio', 'puerta_no_cerro', 'rele_no_accionado'))
    OR (resultado = 'sin_confirmacion' AND causa IN ('sin_sensor', 'sin_respuesta'))
  ),
  ALGORITHM=COPY;
