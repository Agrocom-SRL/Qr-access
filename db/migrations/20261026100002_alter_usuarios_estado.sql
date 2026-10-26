-- migrate:up
-- Estados del usuario (ADR 0033 §1, ADR 0031 §0): `estado` reemplaza a `activo`. «Eliminado» es `deleted_at`.
-- Datos: activo = 1 -> 'activo'; activo = 0 -> 'suspendido' (hoy un usuario con activo = 0 pierde el acceso
-- al instante y sus QR dejan de abrir, RF-06: es el efecto de «suspendido»). Quién lo desactivó no se sabe:
-- se toma `updated_by` y, si no hay, NULL (solo AGROCOM lo levanta). `estado_desde` queda en `updated_at`.
-- La cascada por rama y por cuenta NO se materializa en filas: se deriva de `superior_id` y de
-- `cuentas.estado` al validar (ADR 0031 §2); aquí solo está el estado propio de cada usuario.
ALTER TABLE usuarios
  ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'activo' AFTER activo,
  ADD COLUMN estado_impuesto_por BIGINT UNSIGNED NULL AFTER estado,
  ADD COLUMN estado_desde DATETIME(3) NULL AFTER estado_impuesto_por,
  ADD COLUMN estado_motivo VARCHAR(200) NULL AFTER estado_desde;

-- `updated_at = updated_at` evita que el ON UPDATE de la columna la mueva a la hora de la migración.
UPDATE usuarios
   SET estado = 'suspendido',
       updated_at = updated_at,
       estado_impuesto_por = updated_by,
       estado_desde = updated_at,
       estado_motivo = 'migracion: activo = 0'
 WHERE activo = 0;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_estado_impuesto_por FOREIGN KEY (estado_impuesto_por) REFERENCES usuarios (id),
  -- Listados y conteos por cuenta y estado (cupo, estadísticas, «mis restringidos»).
  ADD KEY idx_usuarios_tenant_estado (tenant_id, estado),
  ADD CONSTRAINT ck_usuarios_estado CHECK (estado IN ('activo', 'restringido', 'suspendido')),
  ADD CONSTRAINT ck_usuarios_estado_datos CHECK (
    (estado = 'activo' AND estado_impuesto_por IS NULL AND estado_desde IS NULL AND estado_motivo IS NULL)
    OR (estado <> 'activo' AND estado_desde IS NOT NULL
         AND estado_motivo IS NOT NULL AND CHAR_LENGTH(TRIM(estado_motivo)) > 0)
  ),
  DROP COLUMN activo;

-- migrate:down
-- Con pérdida: activo = 1 para 'activo' y 'restringido' y 0 para 'suspendido'; motivo, quién y desde cuándo
-- se pierden (siguen en la bitácora). Se repone un índice por `tenant_id` antes de soltar el compuesto,
-- porque la clave foránea fk_usuarios_tenant lo necesita (MariaDB descarta el suyo al crear el compuesto).
ALTER TABLE usuarios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER contrasena_hash;

UPDATE usuarios SET activo = IF(estado = 'suspendido', 0, 1), updated_at = updated_at;

ALTER TABLE usuarios
  DROP CONSTRAINT ck_usuarios_estado_datos,
  DROP CONSTRAINT ck_usuarios_estado,
  DROP FOREIGN KEY fk_usuarios_estado_impuesto_por,
  ADD KEY fk_usuarios_tenant (tenant_id);

ALTER TABLE usuarios
  DROP KEY idx_usuarios_tenant_estado,
  DROP KEY fk_usuarios_estado_impuesto_por,
  DROP COLUMN estado_motivo,
  DROP COLUMN estado_desde,
  DROP COLUMN estado_impuesto_por,
  DROP COLUMN estado;
