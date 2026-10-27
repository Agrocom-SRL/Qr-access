-- migrate:up
-- Excepción a un tope de `configuracion_limites` para una cuenta entera (`usuario_id` NULL) o para un solo
-- usuario (ADR 0030 §7): lo que AGROCOM sube tras analizar un pico, o la bolsa que amplía a una cuenta (§5).
-- Cada alta, cambio o baja queda en la bitácora.
CREATE TABLE excepciones_de_limite (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  clave VARCHAR(60) NOT NULL,
  valor INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  usuario_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(usuario_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_excepciones_de_limite_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_excepciones_de_limite_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  UNIQUE KEY uq_excepciones_de_limite (tenant_id, usuario_clave, clave, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE excepciones_de_limite;
