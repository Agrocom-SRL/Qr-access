-- migrate:up
-- Registro de solo inserción de lo que pasa con los topes de generación de QR (ADR 0030 §5 y §7): cada rechazo
-- por límite, cada reemplazo de un QR propio sin uso y las marcas de la bolsa mensual (80 % y superada). No son
-- intentos de acceso (esos van a `eventos_acceso`). Sin autoría ni soft delete: no se edita ni se borra. De aquí
-- leerán la bandeja de avisos y las señales de abuso.
-- `clave_unica` evita repetir una marca (una vez por evento y día); NULL en los eventos que sí se repiten.
CREATE TABLE eventos_de_limite (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  tipo VARCHAR(40) NOT NULL,
  valor INT UNSIGNED NULL,
  tope INT UNSIGNED NULL,
  clave_unica VARCHAR(80) NULL,
  ocurrido_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_eventos_de_limite_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_eventos_de_limite_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT ck_eventos_de_limite_tipo CHECK (tipo IN (
    'qr.limite_diario', 'qr.limite_pendientes', 'qr.limite_propios_sin_uso',
    'qr.reemplazo_sin_uso', 'bolsa.aviso', 'bolsa.superada'
  )),
  UNIQUE KEY uq_eventos_de_limite_marca (tenant_id, clave_unica),
  KEY idx_eventos_de_limite_usuario (tenant_id, usuario_id, tipo, ocurrido_at),
  KEY idx_eventos_de_limite_tipo (tenant_id, tipo, ocurrido_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE eventos_de_limite;
