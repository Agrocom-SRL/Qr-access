-- migrate:up
CREATE TABLE suscripciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  desde DATETIME(3) NOT NULL,
  hasta DATETIME(3) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'vigente',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  estado_vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL AND estado = 'vigente', 1, NULL)) STORED,
  CONSTRAINT fk_suscripciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_suscripciones_plan FOREIGN KEY (plan_id) REFERENCES planes (id),
  UNIQUE KEY uq_suscripciones_vigente (tenant_id, estado_vigente),
  CONSTRAINT ck_suscripciones_estado CHECK (estado IN ('vigente', 'suspendida', 'vencida')),
  CONSTRAINT ck_suscripciones_ventana CHECK (desde < hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE suscripciones;
