-- migrate:up
-- Topes y umbrales de uso de la plataforma (ADR 0030 §7): los edita AGROCOM, nunca están fijos en el código.
-- Una fila por clave; el valor es un entero (cantidad, segundos o porcentaje según la clave). Sin tenant_id:
-- vale para todas las cuentas, salvo la excepción que una cuenta o un usuario tenga en `excepciones_de_limite`.
CREATE TABLE configuracion_limites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(60) NOT NULL,
  valor INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_configuracion_limites_clave (clave, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valores iniciales. El mismo bloque está en db/seeds/01_catalogo.sql (idempotente y sin pisar lo que AGROCOM
-- haya editado). Los fija el ADR 0030 donde dice un número (reemplazos y espera del §2.1, 80 % del §5, 10 puertas
-- del ADR 0031 §9); el tope diario, el de pendientes y la bolsa son supuestos de partida a refinar con datos reales.
INSERT INTO configuracion_limites (clave, valor) VALUES
  ('qr.tope_diario', 100),
  ('qr.tope_pendientes', 50),
  ('qr.reemplazos_sin_uso_por_dia', 5),
  ('qr.espera_reemplazo_segundos', 120),
  ('qr.max_puertas_por_qr', 10),
  ('qr.bolsa_mensual', 5000),
  ('qr.bolsa_aviso_porcentaje', 80)
ON DUPLICATE KEY UPDATE clave = VALUES(clave);

-- migrate:down
DROP TABLE configuracion_limites;
