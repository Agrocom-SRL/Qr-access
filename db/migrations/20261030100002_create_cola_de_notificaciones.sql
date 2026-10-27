-- migrate:up
-- Outbox de avisos (ADR 0030 §6): quien detecta algo (p. ej. el detector de estados de placa) deja aquí el
-- aviso en la MISMA transacción que su cambio de estado; otro proceso lo entrega después, por canal. La entrega
-- es at-least-once: se reintenta con espera creciente (`intentos`, `proximo_intento_at`) hasta agotar los
-- intentos (`fallida`), y quien recibe es idempotente (índices únicos de `notificaciones`), así que repetir un
-- mensaje no duplica nada. `clave_unica` evita encolar dos veces el mismo aviso (la misma evaluación repetida).
-- `agrupacion_clave` ordena la entrega: los mensajes de un mismo grupo se aplican en orden de id.
-- Canal previsto: `app` (la bandeja propia). `push` y `correo` quedan reservados; no hay proveedor integrado.
-- Sin bitácora (`dominio_sin_bitacora`): es infraestructura de entrega, no un cambio de negocio.
-- Retención: se mantiene el soft delete (invariante 8) y NO un DELETE físico; el volumen es bajo (un mensaje por
-- cambio de membresía de un grupo) y así el criterio es el mismo que el de toda tabla de dominio. La depuración y el
-- re-drive de los `fallida` leen por `(estado, updated_at)`: de ahí `idx_cola_de_notificaciones_retencion`.
CREATE TABLE cola_de_notificaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  audiencia VARCHAR(12) NOT NULL,
  canal VARCHAR(10) NOT NULL DEFAULT 'app',
  agrupacion_clave VARCHAR(100) NOT NULL,
  carga JSON NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
  intentos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  proximo_intento_at DATETIME(3) NOT NULL,
  ultimo_error VARCHAR(60) NULL,
  entregada_at DATETIME(3) NULL,
  clave_unica VARCHAR(160) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_cola_de_notificaciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT ck_cola_de_notificaciones_audiencia CHECK (audiencia IN ('cuenta', 'plataforma')),
  CONSTRAINT ck_cola_de_notificaciones_canal CHECK (canal IN ('app', 'push', 'correo')),
  CONSTRAINT ck_cola_de_notificaciones_estado CHECK (estado IN ('pendiente', 'entregada', 'fallida', 'omitida')),
  UNIQUE KEY uq_cola_de_notificaciones_clave (tenant_id, clave_unica),
  KEY idx_cola_de_notificaciones_pendientes (estado, proximo_intento_at, id),
  KEY idx_cola_de_notificaciones_grupo (tenant_id, agrupacion_clave, estado),
  KEY idx_cola_de_notificaciones_retencion (estado, updated_at, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE cola_de_notificaciones;
