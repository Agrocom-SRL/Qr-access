-- migrate:up
-- La orden de abrir que la API le da a la puerta cuando un usuario pide la apertura manual desde la app (ADR 0035
-- §3). Es de la puerta, no de una placa: `dispositivo_id` es NULL mientras está `pendiente` y se llena cuando la
-- primera placa de esa puerta la toma (entrega atómica, una sola vez). Sin `sentido`. Cambia de estado, por eso no
-- es de solo inserción ni lleva soft delete (se archiva con la retención, duda D-06). El hecho queda en `lecturas`
-- y el resultado físico en `confirmaciones_apertura`.
-- `vigente_clave` es 1 mientras la orden está viva (`pendiente` o `entregada`): sostiene una sola orden viva por
-- puerta (no se acumulan pulsos sobre el mismo relé), igual que el ADR 0016 con lo borrado.
CREATE TABLE ordenes_apertura (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  lectura_id BIGINT UNSIGNED NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
  vence_at DATETIME(3) NOT NULL,
  entregada_at DATETIME(3) NULL,
  resuelta_at DATETIME(3) NULL,
  clave_idempotencia VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  vigente_clave TINYINT GENERATED ALWAYS AS (IF(estado IN ('pendiente', 'entregada'), 1, NULL)) STORED,
  CONSTRAINT fk_ordenes_apertura_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_ordenes_apertura_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT fk_ordenes_apertura_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_ordenes_apertura_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_ordenes_apertura_lectura FOREIGN KEY (lectura_id) REFERENCES lecturas (id),
  CONSTRAINT ck_ordenes_apertura_estado CHECK (estado IN ('pendiente', 'entregada', 'ejecutada', 'fallida', 'vencida')),
  CONSTRAINT ck_ordenes_apertura_vence CHECK (vence_at <= created_at + INTERVAL 30 SECOND),
  UNIQUE KEY uq_ordenes_apertura_vigente (puerta_id, vigente_clave),
  UNIQUE KEY uq_ordenes_apertura_clave (tenant_id, usuario_id, clave_idempotencia),
  KEY idx_ordenes_apertura_entrega (puerta_id, estado, vence_at),
  KEY idx_ordenes_apertura_vencimiento (estado, vence_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE ordenes_apertura;
