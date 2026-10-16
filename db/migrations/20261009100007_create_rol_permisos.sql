-- migrate:up
CREATE TABLE rol_permisos (
  rol_id BIGINT UNSIGNED NOT NULL,
  permiso_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (rol_id, permiso_id),
  CONSTRAINT fk_rol_permisos_rol FOREIGN KEY (rol_id) REFERENCES roles (id),
  CONSTRAINT fk_rol_permisos_permiso FOREIGN KEY (permiso_id) REFERENCES permisos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE rol_permisos;
