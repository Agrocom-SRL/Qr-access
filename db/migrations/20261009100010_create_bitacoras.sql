-- migrate:up
CREATE TABLE bitacoras (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  tabla VARCHAR(64) NOT NULL,
  registro_id BIGINT UNSIGNED NOT NULL,
  accion VARCHAR(12) NOT NULL,
  origen VARCHAR(12) NOT NULL,
  antes JSON NULL,
  despues JSON NULL,
  ocurrido_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_bitacoras_registro (tabla, registro_id),
  KEY idx_bitacoras_tenant (tenant_id, ocurrido_at),
  CONSTRAINT ck_bitacoras_accion CHECK (accion IN ('creado', 'actualizado', 'eliminado', 'restaurado')),
  CONSTRAINT ck_bitacoras_origen CHECK (origen IN ('api', 'dispositivo', 'sistema'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE bitacoras;
