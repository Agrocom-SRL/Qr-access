-- migrate:up
-- Vinculación automática (ADR 0026): las placas se anuncian solas, sin código de fábrica. La
-- placa deja de guardar secretos: la clave definitiva vive en `dispositivos.clave_hash` desde que
-- se confirma, y lo que la placa propone mientras tanto vive en `placas_anuncios`.
ALTER TABLE placas
  DROP COLUMN codigo_hash,
  DROP COLUMN clave_hash,
  CHANGE COLUMN ultimo_reclamo_at ultimo_anuncio_at DATETIME(3) NULL,
  -- La solicitud del super admin, a la espera de que alguien pulse el botón de la placa.
  -- Sin llaves foráneas: se revalidan al confirmar y la tabla es de plataforma (sin tenant_id).
  ADD COLUMN por_confirmar_hasta DATETIME(3) NULL AFTER ultima_ip,
  ADD COLUMN vinculo_cuenta_id BIGINT UNSIGNED NULL AFTER por_confirmar_hasta,
  ADD COLUMN vinculo_puerta_id BIGINT UNSIGNED NULL AFTER vinculo_cuenta_id,
  ADD COLUMN vinculo_nombre VARCHAR(100) NULL AFTER vinculo_puerta_id,
  ADD COLUMN vinculo_solicitado_por BIGINT UNSIGNED NULL AFTER vinculo_nombre;

-- Candidatos de una placa: cada `(mac, clave)` que se anuncia. Una MAC es pública, así que puede
-- haber uno falso junto al real; el único que se vuelve dispositivo es el que confirma con el
-- botón. Transitoria (como `sesiones`): no se borra, se marca `descartada_at`. La huella es el
-- SHA-256 de una clave de 256 bits aleatorios (no adivinable): permite reconocer al candidato en
-- cada anuncio sin gastar un argon2id anónimo; el argon2id se calcula una vez, al confirmar.
CREATE TABLE placas_anuncios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  placa_id BIGINT UNSIGNED NOT NULL,
  clave_huella CHAR(64) NOT NULL,
  firmware_version VARCHAR(20) NULL,
  ip VARCHAR(45) NULL,
  ultimo_anuncio_at DATETIME(3) NOT NULL,
  descartada_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_placas_anuncios_placa FOREIGN KEY (placa_id) REFERENCES placas (id),
  UNIQUE KEY uq_placas_anuncios_clave (placa_id, clave_huella)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE placas_anuncios;
ALTER TABLE placas
  DROP COLUMN vinculo_solicitado_por,
  DROP COLUMN vinculo_nombre,
  DROP COLUMN vinculo_puerta_id,
  DROP COLUMN vinculo_cuenta_id,
  DROP COLUMN por_confirmar_hasta,
  CHANGE COLUMN ultimo_anuncio_at ultimo_reclamo_at DATETIME(3) NULL,
  ADD COLUMN clave_hash VARCHAR(255) NULL AFTER mac,
  ADD COLUMN codigo_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER mac;
