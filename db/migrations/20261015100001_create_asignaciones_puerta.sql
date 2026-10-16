-- migrate:up
-- Puertas a las que está asignado un usuario (típicamente un guardia). `puerta_id` NULL = todas las
-- puertas de la cuenta. `puerta_clave` hace que ese NULL también cuente en la unicidad (ADR 0016).
CREATE TABLE asignaciones_puerta (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  puerta_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(puerta_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_asignaciones_puerta_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_asignaciones_puerta_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_asignaciones_puerta_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  UNIQUE KEY uq_asignaciones_puerta (usuario_id, puerta_clave, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE asignaciones_puerta;
