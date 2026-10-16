-- migrate:up
CREATE TABLE permisos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL,
  ambito VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_permisos_codigo (codigo),
  CONSTRAINT ck_permisos_ambito CHECK (ambito IN ('plataforma', 'cuenta'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE permisos;
