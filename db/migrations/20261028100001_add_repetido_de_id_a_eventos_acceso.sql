-- migrate:up
-- Ventana de repetición y registro sin ruido (ADR 0032 §3 y §4). `repetido_de_id` apunta al primer
-- intento (el original) cuando el MISMO dispositivo repite el MISMO token dentro de la ventana.
-- La tabla es de solo inserción: la columna se escribe en el INSERT de la fila repetida; ninguna
-- fila se actualiza (invariante 4, ADR 0007). Un original tiene `repetido_de_id` NULL, y un
-- repetido nunca apunta a otro repetido (siempre al original), así la ventana no se encadena.
--
-- Segura con la tabla poblada: `eventos_acceso` recibe escrituras sin parar (cada lectura de una
-- placa), y un ALTER que mezcla columna y clave foránea hace una COPIA de la tabla que bloquea las
-- escrituras. Por eso van tres pasos, cada uno con ALGORITHM=INPLACE, LOCK=NONE (si MariaDB no
-- puede cumplirlo, el paso FALLA en vez de bloquear), y la clave foránea se agrega con
-- foreign_key_checks=0 en esta sesión (MariaDB 10.11): la columna nace toda en NULL, no hay
-- filas que validar, y sin esa verificación el ALTER no necesita copiar. Ver docs/gestion/despliegue.md.

-- 1. La columna (NULL, sin valor por omisión que reescriba filas).
ALTER TABLE eventos_acceso
  ADD COLUMN repetido_de_id BIGINT UNSIGNED NULL AFTER leido_en_dispositivo_at,
  ALGORITHM=INPLACE, LOCK=NONE;

-- 2. Los índices (la clave foránea reutiliza el segundo).
ALTER TABLE eventos_acceso
  ADD KEY idx_eventos_acceso_repeticion (tenant_id, dispositivo_id, token_hash, ocurrido_at),
  ADD KEY idx_eventos_acceso_repetido_de (repetido_de_id),
  ALGORITHM=INPLACE, LOCK=NONE;

-- 3. La clave foránea, sin verificar filas (todas son NULL).
SET @fk_anterior = @@foreign_key_checks;
SET foreign_key_checks = 0;
ALTER TABLE eventos_acceso
  ADD CONSTRAINT fk_eventos_acceso_repetido_de FOREIGN KEY (repetido_de_id) REFERENCES eventos_acceso (id),
  ALGORITHM=INPLACE, LOCK=NONE;
SET foreign_key_checks = @fk_anterior;

-- migrate:down
ALTER TABLE eventos_acceso
  DROP FOREIGN KEY fk_eventos_acceso_repetido_de,
  ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE eventos_acceso
  DROP KEY idx_eventos_acceso_repetido_de,
  DROP KEY idx_eventos_acceso_repeticion,
  ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE eventos_acceso
  DROP COLUMN repetido_de_id,
  ALGORITHM=INPLACE, LOCK=NONE;
