-- migrate:up
-- Metadatos de un archivo subido como comprobante de un pago (ADR 0024). Es de plataforma: lo sube el
-- super admin antes de que el pago (o la cuenta, en el alta) exista, por eso no lleva tenant_id; el pago
-- lo referencia y de él se deduce la cuenta. El archivo vive fuera de la base (`ruta` es relativa al almacén).
CREATE TABLE comprobantes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ruta VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(40) NOT NULL,
  tamano INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_comprobantes_ruta (ruta),
  CONSTRAINT ck_comprobantes_tipo CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down
DROP TABLE comprobantes;
