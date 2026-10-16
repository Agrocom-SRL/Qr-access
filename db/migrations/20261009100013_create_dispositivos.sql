-- migrate:up
CREATE TABLE dispositivos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  clave_hash VARCHAR(255) NOT NULL,
  firmware_version VARCHAR(20) NULL,
  ultimo_latido_at DATETIME(3) NULL,
  ultimo_rssi SMALLINT NULL,
  ultima_puerta_abierta TINYINT(1) NULL,
  revocado_at DATETIME(3) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  en_servicio TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL AND revocado_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_dispositivos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_dispositivos_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  UNIQUE KEY uq_dispositivos_puerta (puerta_id, en_servicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE dispositivos;
