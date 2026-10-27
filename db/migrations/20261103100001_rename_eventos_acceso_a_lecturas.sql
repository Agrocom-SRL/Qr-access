-- migrate:up
-- La tabla `eventos_acceso` pasa a llamarse `lecturas` (decisión de Miguel, 2026-10-26/27, ADR 0032 §5): cada fila
-- es un intento de lectura de un QR, aceptado o rechazado. La tabla sigue siendo de SOLO INSERCIÓN (invariante 4,
-- ADR 0007); cambia el nombre, no el contrato.
--
-- Segura con la tabla poblada: la placa escribe una fila por lectura, así que nada de esto puede copiar la tabla
-- ni bloquear las escrituras.
--  1. `RENAME TABLE` es atómico y solo toca metadatos. Las claves foráneas que apuntan a la tabla
--     (`confirmaciones_apertura.fk_confirmaciones_apertura_evento` y la autorreferencia `repetido_de_id`) siguen
--     al nombre nuevo solas, sin tocar sus filas.
--  2. Los índices NO se renombran solos: `RENAME INDEX` con ALGORITHM=INPLACE, LOCK=NONE es solo metadatos (si
--     MariaDB no puede cumplirlo, FALLA en vez de bloquear). Incluye los dos índices que InnoDB creó para las
--     claves foráneas de `puerta_id` y `dispositivo_id` (heredan el nombre de la clave).
--  3. Las claves foráneas NO se renombran solas y MariaDB 10.11 no tiene `RENAME CONSTRAINT`: se quitan y se
--     vuelven a agregar en el MISMO `ALTER` (sin ventana sin clave), con foreign_key_checks=0 para que no revise
--     las filas (ya eran válidas) y el ALTER no necesite copiar la tabla. Mismo patrón que la migración
--     `add_repetido_de_id_a_eventos_acceso`.
--  4. Los CHECK (`ck_eventos_acceso_metodo`, `ck_eventos_acceso_resultado`) conservan el nombre antiguo A
--     PROPÓSITO: MariaDB no permite `ADD CONSTRAINT ... CHECK` con INPLACE (solo ALGORITHM=COPY, que reescribe la
--     tabla y bloquea las escrituras; medido: 4 s con 200 000 filas, crece con la tabla). Su nombre solo aparece
--     en el mensaje de un INSERT inválido, que la API nunca produce. Quedan documentados en la ficha de la tabla.

RENAME TABLE eventos_acceso TO lecturas;

ALTER TABLE lecturas
  RENAME INDEX idx_eventos_acceso_puerta TO idx_lecturas_puerta,
  RENAME INDEX idx_eventos_acceso_fecha TO idx_lecturas_fecha,
  RENAME INDEX idx_eventos_acceso_qr TO idx_lecturas_qr,
  RENAME INDEX idx_eventos_acceso_repeticion TO idx_lecturas_repeticion,
  RENAME INDEX idx_eventos_acceso_repetido_de TO idx_lecturas_repetido_de,
  RENAME INDEX idx_eventos_acceso_global TO idx_lecturas_global,
  RENAME INDEX fk_eventos_acceso_puerta TO fk_lecturas_puerta,
  RENAME INDEX fk_eventos_acceso_dispositivo TO fk_lecturas_dispositivo,
  ALGORITHM=INPLACE, LOCK=NONE;

SET @fk_anterior = @@foreign_key_checks;
SET foreign_key_checks = 0;
ALTER TABLE lecturas
  DROP FOREIGN KEY fk_eventos_acceso_tenant,
  DROP FOREIGN KEY fk_eventos_acceso_puerta,
  DROP FOREIGN KEY fk_eventos_acceso_dispositivo,
  DROP FOREIGN KEY fk_eventos_acceso_qr,
  DROP FOREIGN KEY fk_eventos_acceso_repetido_de,
  ADD CONSTRAINT fk_lecturas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  ADD CONSTRAINT fk_lecturas_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  ADD CONSTRAINT fk_lecturas_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  ADD CONSTRAINT fk_lecturas_qr FOREIGN KEY (qr_acceso_id) REFERENCES qr_accesos (id),
  ADD CONSTRAINT fk_lecturas_repetido_de FOREIGN KEY (repetido_de_id) REFERENCES lecturas (id),
  ALGORITHM=INPLACE, LOCK=NONE;
SET foreign_key_checks = @fk_anterior;

-- migrate:down
-- Revierte exactamente el `up`, con las mismas garantías (nada copia la tabla). El nombre `eventos_acceso` vuelve
-- a ser el de la tabla y de sus índices y claves; el código desplegado antes de este cambio vuelve a funcionar.
SET @fk_anterior = @@foreign_key_checks;
SET foreign_key_checks = 0;
ALTER TABLE lecturas
  DROP FOREIGN KEY fk_lecturas_tenant,
  DROP FOREIGN KEY fk_lecturas_puerta,
  DROP FOREIGN KEY fk_lecturas_dispositivo,
  DROP FOREIGN KEY fk_lecturas_qr,
  DROP FOREIGN KEY fk_lecturas_repetido_de,
  ADD CONSTRAINT fk_eventos_acceso_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  ADD CONSTRAINT fk_eventos_acceso_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  ADD CONSTRAINT fk_eventos_acceso_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  ADD CONSTRAINT fk_eventos_acceso_qr FOREIGN KEY (qr_acceso_id) REFERENCES qr_accesos (id),
  ADD CONSTRAINT fk_eventos_acceso_repetido_de FOREIGN KEY (repetido_de_id) REFERENCES lecturas (id),
  ALGORITHM=INPLACE, LOCK=NONE;
SET foreign_key_checks = @fk_anterior;

ALTER TABLE lecturas
  RENAME INDEX idx_lecturas_puerta TO idx_eventos_acceso_puerta,
  RENAME INDEX idx_lecturas_fecha TO idx_eventos_acceso_fecha,
  RENAME INDEX idx_lecturas_qr TO idx_eventos_acceso_qr,
  RENAME INDEX idx_lecturas_repeticion TO idx_eventos_acceso_repeticion,
  RENAME INDEX idx_lecturas_repetido_de TO idx_eventos_acceso_repetido_de,
  RENAME INDEX idx_lecturas_global TO idx_eventos_acceso_global,
  RENAME INDEX fk_lecturas_puerta TO fk_eventos_acceso_puerta,
  RENAME INDEX fk_lecturas_dispositivo TO fk_eventos_acceso_dispositivo,
  ALGORITHM=INPLACE, LOCK=NONE;

RENAME TABLE lecturas TO eventos_acceso;
