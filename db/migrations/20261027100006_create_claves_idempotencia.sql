-- migrate:up
-- Claves de idempotencia (ADR 0031 §11): un reintento de `POST /qr-accesos` con la misma `Idempotency-Key` y el
-- mismo cuerpo devuelve la misma respuesta sin generar otro QR ni gastar topes. Tabla transitoria (como `sesiones`):
-- sin soft delete ni autoría, y las filas vencidas se BORRAN de verdad (excepción a la invariante 8: son un caché
-- con vencimiento corto, no datos de dominio; el QR que originó la fila sí queda en `qr_accesos` y en la bitácora).
-- La clave se guarda solo como HMAC-SHA256 con una subclave de `QR_IDEMPOTENCIA_CLAVE` (`clave_hash`). La respuesta guardada
-- NO lleva el token del QR: al repetir, el servidor lo vuelve a derivar de la clave y de `created_at` (ver `token-qr.ts`),
-- comprueba que su hash sea el de `qr_accesos` y nunca queda en claro ni cifrado en la base (ADR 0008).
-- Solo se guardan generaciones que crearon un QR nuevo: un QR propio reutilizado ya es idempotente por sí solo.
-- `huella` es el SHA-256 del cuerpo normalizado: misma clave con otra huella = `idempotencia.conflicto`.
-- La unicidad es por cuenta Y usuario: una clave nunca cruza usuarios ni cuentas.
CREATE TABLE claves_idempotencia (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  operacion VARCHAR(40) NOT NULL,
  clave_hash CHAR(64) NOT NULL,
  huella CHAR(64) NOT NULL,
  respuesta JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  vence_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_claves_idempotencia_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_claves_idempotencia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT ck_claves_idempotencia_operacion CHECK (operacion IN ('qr.generar')),
  UNIQUE KEY uq_claves_idempotencia_clave (tenant_id, usuario_id, operacion, clave_hash),
  KEY idx_claves_idempotencia_vence (vence_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE claves_idempotencia;
