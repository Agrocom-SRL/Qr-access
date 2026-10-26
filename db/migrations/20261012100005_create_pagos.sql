-- migrate:up
CREATE TABLE pagos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  suscripcion_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  fecha_pago DATE NOT NULL,
  medio VARCHAR(20) NOT NULL,
  referencia VARCHAR(80) NOT NULL,
  periodo_desde DATETIME(3) NOT NULL,
  periodo_hasta DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_pagos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_pagos_suscripcion FOREIGN KEY (suscripcion_id) REFERENCES suscripciones (id),
  CONSTRAINT fk_pagos_plan FOREIGN KEY (plan_id) REFERENCES planes (id),
  KEY idx_pagos_tenant_fecha (tenant_id, fecha_pago),
  KEY idx_pagos_fecha (fecha_pago),
  CONSTRAINT ck_pagos_tipo CHECK (tipo IN ('renovacion', 'mejora_de_plan')),
  CONSTRAINT ck_pagos_medio CHECK (medio IN ('transferencia', 'deposito', 'efectivo')),
  CONSTRAINT ck_pagos_monto CHECK (monto > 0),
  CONSTRAINT ck_pagos_periodo CHECK (periodo_desde < periodo_hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE pagos;
