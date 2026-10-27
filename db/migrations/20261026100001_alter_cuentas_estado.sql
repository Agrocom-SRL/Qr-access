-- migrate:up
-- Estados de la cuenta (ADR 0033 §1, ADR 0031 §0): `estado` reemplaza a `activo`. «Eliminado» no es un valor:
-- es `deleted_at` (soft delete, invariante 8). Quién impuso el estado y desde cuándo se guardan para que
-- un estado impuesto por un superior no lo levante quien está debajo; el motivo es obligatorio.
-- Datos: activo = 1 -> 'activo'; activo = 0 -> 'suspendido', porque hoy una cuenta con activo = 0 no inicia
-- sesión, no autentica sus dispositivos y sus QR no abren, que es exactamente el efecto de «suspendido».
-- No se sabe quién la desactivó: se toma `updated_by` (el último que la editó) y, si no hay, NULL
-- (solo AGROCOM la levanta). `estado_desde` queda en `updated_at`.
ALTER TABLE cuentas
  ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'activo' AFTER activo,
  ADD COLUMN estado_impuesto_por BIGINT UNSIGNED NULL AFTER estado,
  ADD COLUMN estado_desde DATETIME(3) NULL AFTER estado_impuesto_por,
  ADD COLUMN estado_motivo VARCHAR(200) NULL AFTER estado_desde;

-- `updated_at = updated_at` evita que el ON UPDATE de la columna la mueva a la hora de la migración.
UPDATE cuentas
   SET estado = 'suspendido',
       updated_at = updated_at,
       estado_impuesto_por = updated_by,
       estado_desde = updated_at,
       estado_motivo = 'migracion: activo = 0'
 WHERE activo = 0;

ALTER TABLE cuentas
  ADD CONSTRAINT fk_cuentas_estado_impuesto_por FOREIGN KEY (estado_impuesto_por) REFERENCES usuarios (id),
  ADD KEY idx_cuentas_estado (estado),
  ADD CONSTRAINT ck_cuentas_estado CHECK (estado IN ('activo', 'restringido', 'suspendido')),
  -- Activo no arrastra datos de un estado anterior; cualquier otro estado trae desde cuándo y por qué.
  ADD CONSTRAINT ck_cuentas_estado_datos CHECK (
    (estado = 'activo' AND estado_impuesto_por IS NULL AND estado_desde IS NULL AND estado_motivo IS NULL)
    OR (estado <> 'activo' AND estado_desde IS NOT NULL
         AND estado_motivo IS NOT NULL AND CHAR_LENGTH(TRIM(estado_motivo)) > 0)
  ),
  DROP COLUMN activo;

-- migrate:down
-- Con pérdida: activo = 1 para 'activo' y 'restringido' (una cuenta restringida sí funciona) y 0 para
-- 'suspendido'. El motivo, quién y desde cuándo se pierden (siguen en la bitácora).
ALTER TABLE cuentas ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER codigo;

UPDATE cuentas SET activo = IF(estado = 'suspendido', 0, 1), updated_at = updated_at;

ALTER TABLE cuentas
  DROP CONSTRAINT ck_cuentas_estado_datos,
  DROP CONSTRAINT ck_cuentas_estado,
  DROP FOREIGN KEY fk_cuentas_estado_impuesto_por,
  DROP KEY idx_cuentas_estado,
  DROP KEY fk_cuentas_estado_impuesto_por,
  DROP COLUMN estado_motivo,
  DROP COLUMN estado_desde,
  DROP COLUMN estado_impuesto_por,
  DROP COLUMN estado;
