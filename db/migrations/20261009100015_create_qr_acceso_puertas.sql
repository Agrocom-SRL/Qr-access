-- migrate:up
CREATE TABLE qr_acceso_puertas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  qr_acceso_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_qr_acceso_puertas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_qr_acceso_puertas_qr FOREIGN KEY (qr_acceso_id) REFERENCES qr_accesos (id),
  CONSTRAINT fk_qr_acceso_puertas_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  UNIQUE KEY uq_qr_acceso_puertas (qr_acceso_id, puerta_id, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE qr_acceso_puertas;
