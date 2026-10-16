-- migrate:up
CREATE TABLE sesiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  rol_activo_id BIGINT UNSIGNED NULL,
  refresh_hash CHAR(64) NOT NULL,
  agente VARCHAR(255) NULL,
  ip VARCHAR(45) NULL,
  expira_at DATETIME(3) NOT NULL,
  revocada_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sesiones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_sesiones_rol_activo FOREIGN KEY (rol_activo_id) REFERENCES roles (id),
  UNIQUE KEY uq_sesiones_refresh (refresh_hash),
  KEY idx_sesiones_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE sesiones;
