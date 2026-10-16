-- migrate:up
CREATE TABLE cuenta_datos_empresa (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  nit VARCHAR(20) NOT NULL,
  ciudad VARCHAR(80) NOT NULL,
  contacto_nombre VARCHAR(120) NOT NULL,
  contacto_telefono VARCHAR(30) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_cuenta_datos_empresa_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_cuenta_datos_empresa_cuenta (tenant_clave, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE cuenta_datos_empresa;
