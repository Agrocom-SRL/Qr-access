-- migrate:up
-- En todo el producto un QR se "genera", no se "emite": la columna, su índice y su clave foránea se
-- renombran, y el permiso pasa de `accesos.qr.emitir` a `accesos.qr.generar`. Los roles apuntan al
-- permiso por id (`rol_permisos.permiso_id`), así que conservan lo que tenían sin tocar sus filas.
ALTER TABLE qr_accesos DROP FOREIGN KEY fk_qr_accesos_emisor;
ALTER TABLE qr_accesos RENAME COLUMN emitido_por TO generado_por;
ALTER TABLE qr_accesos RENAME INDEX idx_qr_accesos_emisor TO idx_qr_accesos_generador;
ALTER TABLE qr_accesos
  ADD CONSTRAINT fk_qr_accesos_generador FOREIGN KEY (generado_por) REFERENCES usuarios (id);

UPDATE permisos SET codigo = 'accesos.qr.generar' WHERE codigo = 'accesos.qr.emitir';

-- migrate:down
UPDATE permisos SET codigo = 'accesos.qr.emitir' WHERE codigo = 'accesos.qr.generar';

ALTER TABLE qr_accesos DROP FOREIGN KEY fk_qr_accesos_generador;
ALTER TABLE qr_accesos RENAME INDEX idx_qr_accesos_generador TO idx_qr_accesos_emisor;
ALTER TABLE qr_accesos RENAME COLUMN generado_por TO emitido_por;
ALTER TABLE qr_accesos
  ADD CONSTRAINT fk_qr_accesos_emisor FOREIGN KEY (emitido_por) REFERENCES usuarios (id);
