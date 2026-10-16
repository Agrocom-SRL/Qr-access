-- migrate:up
CREATE TABLE usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  etiqueta VARCHAR(80) NULL,
  pin_indice CHAR(64) NULL,
  pin_hash VARCHAR(255) NULL,
  pin_generado_at DATETIME(3) NULL,
  username VARCHAR(60) NULL,
  contrasena_hash VARCHAR(255) NULL,
  rol_preferido_id BIGINT UNSIGNED NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_usuarios_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_usuarios_rol_preferido FOREIGN KEY (rol_preferido_id) REFERENCES roles (id),
  UNIQUE KEY uq_usuarios_pin (tenant_clave, pin_indice, vigente),
  UNIQUE KEY uq_usuarios_username (tenant_clave, username, vigente),
  CONSTRAINT ck_usuarios_credencial CHECK (
    (tenant_id IS NOT NULL AND pin_indice IS NOT NULL AND pin_hash IS NOT NULL)
    OR (tenant_id IS NULL AND username IS NOT NULL AND contrasena_hash IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE usuarios;
