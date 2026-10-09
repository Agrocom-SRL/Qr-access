-- migrate:up
CREATE TABLE puertas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  sitio_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  segundos_apertura TINYINT UNSIGNED NOT NULL DEFAULT 5,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_puertas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_puertas_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id),
  UNIQUE KEY uq_puertas_nombre (sitio_id, nombre, vigente),
  CONSTRAINT ck_puertas_segundos CHECK (segundos_apertura BETWEEN 1 AND 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE puertas;
