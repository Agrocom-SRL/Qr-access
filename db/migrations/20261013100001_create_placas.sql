-- migrate:up
-- Inventario de controladores físicos (ADR 0025). Es de la plataforma: no lleva tenant_id, igual
-- que `planes`; una placa no pertenece a ninguna cuenta hasta que AGROCOM le crea un dispositivo.
CREATE TABLE placas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  mac CHAR(17) NOT NULL,
  codigo_hash VARCHAR(255) NOT NULL,
  clave_hash VARCHAR(255) NULL,
  firmware_version VARCHAR(20) NULL,
  ultimo_reclamo_at DATETIME(3) NULL,
  ultima_ip VARCHAR(45) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_placas_mac (mac, vigente),
  CONSTRAINT ck_placas_mac CHECK (mac REGEXP '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE placas;
