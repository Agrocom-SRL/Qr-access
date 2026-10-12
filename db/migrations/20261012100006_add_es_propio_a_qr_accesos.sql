-- migrate:up
-- El QR propio ("Mi QR de acceso") se emite cada vez que el usuario abre su pantalla pero se le
-- presenta como uno fijo: no aparece en "Mis QR" y solo puede haber uno activo por usuario.
-- `propio_activo` vale 1 mientras el QR propio no se anule ni se use (como `en_servicio`,
-- ADR 0016): el UNIQUE impide, aun con dos emisiones a la vez, dos QR propios activos.
ALTER TABLE qr_accesos
  ADD COLUMN es_propio TINYINT(1) NOT NULL DEFAULT 0 AFTER etiqueta,
  ADD COLUMN propio_activo TINYINT GENERATED ALWAYS AS (
    IF(es_propio = 1 AND anulado_at IS NULL AND usado_at IS NULL AND deleted_at IS NULL, 1, NULL)
  ) STORED,
  ADD UNIQUE KEY uq_qr_accesos_propio_activo (emitido_por, propio_activo);

-- migrate:down
ALTER TABLE qr_accesos
  DROP INDEX uq_qr_accesos_propio_activo,
  DROP COLUMN propio_activo,
  DROP COLUMN es_propio;
