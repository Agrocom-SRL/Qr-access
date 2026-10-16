-- migrate:up
CREATE TABLE qr_accesos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  emitido_por BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  etiqueta VARCHAR(60) NULL,
  vence_at DATETIME(3) NOT NULL,
  usado_at DATETIME(3) NULL,
  usado_dispositivo_id BIGINT UNSIGNED NULL,
  anulado_at DATETIME(3) NULL,
  anulado_por BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_qr_accesos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_qr_accesos_emisor FOREIGN KEY (emitido_por) REFERENCES usuarios (id),
  CONSTRAINT fk_qr_accesos_dispositivo FOREIGN KEY (usado_dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_qr_accesos_anulador FOREIGN KEY (anulado_por) REFERENCES usuarios (id),
  UNIQUE KEY uq_qr_accesos_token (token_hash),
  KEY idx_qr_accesos_emisor (tenant_id, emitido_por, created_at),
  KEY idx_qr_accesos_vencimiento (tenant_id, vence_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE qr_accesos;
