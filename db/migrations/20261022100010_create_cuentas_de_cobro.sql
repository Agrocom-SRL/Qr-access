-- migrate:up
-- Las cuentas donde AGROCOM recibe los pagos de las suscripciones (ADR 0029): una cuenta bancaria para
-- transferencias o un QR de cobro. Es de plataforma (sin tenant_id) y solo la gestiona el super admin. El QR es
-- una imagen del almacén de archivos (`comprobantes`, ADR 0024).
CREATE TABLE cuentas_de_cobro (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  metodo VARCHAR(20) NOT NULL,
  banco VARCHAR(60) NOT NULL,
  titular VARCHAR(120) NULL,
  numero_cuenta VARCHAR(40) NULL,
  tipo_cuenta VARCHAR(20) NULL,
  imagen_id BIGINT UNSIGNED NULL,
  nota VARCHAR(200) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_cuentas_de_cobro_imagen FOREIGN KEY (imagen_id) REFERENCES comprobantes (id),
  UNIQUE KEY uq_cuentas_de_cobro_numero (banco, numero_cuenta, vigente),
  CONSTRAINT ck_cuentas_de_cobro_metodo CHECK (metodo IN ('transferencia', 'qr')),
  CONSTRAINT ck_cuentas_de_cobro_tipo CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('ahorro', 'corriente')),
  CONSTRAINT ck_cuentas_de_cobro_transferencia CHECK (metodo <> 'transferencia' OR (titular IS NOT NULL AND numero_cuenta IS NOT NULL)),
  CONSTRAINT ck_cuentas_de_cobro_qr CHECK (metodo <> 'qr' OR imagen_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE cuentas_de_cobro;
