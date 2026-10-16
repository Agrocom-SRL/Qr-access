-- migrate:up
CREATE TABLE eventos_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  qr_acceso_id BIGINT UNSIGNED NULL,
  token_hash CHAR(64) NULL,
  metodo VARCHAR(20) NOT NULL DEFAULT 'qr',
  resultado VARCHAR(10) NOT NULL,
  motivo_code VARCHAR(60) NOT NULL,
  ocurrido_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  leido_en_dispositivo_at DATETIME(3) NULL,
  KEY idx_eventos_acceso_puerta (tenant_id, puerta_id, ocurrido_at),
  KEY idx_eventos_acceso_fecha (tenant_id, ocurrido_at),
  KEY idx_eventos_acceso_qr (qr_acceso_id),
  CONSTRAINT fk_eventos_acceso_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_eventos_acceso_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT fk_eventos_acceso_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_eventos_acceso_qr FOREIGN KEY (qr_acceso_id) REFERENCES qr_accesos (id),
  CONSTRAINT ck_eventos_acceso_metodo CHECK (metodo IN ('qr', 'pulsador', 'forzada')),
  CONSTRAINT ck_eventos_acceso_resultado CHECK (resultado IN ('permitido', 'rechazado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE eventos_acceso;
