-- migrate:up
-- Anulación masiva de QR (ADR 0031 §3, ADR 0033 §3, ola W11): UNA fila por pedido, con el alcance, el motivo y cuántos QR
-- se anularon. Cada QR anulado deja además su propia fila de bitácora (`qr_accesos.anulado_at`/`anulado_por`); esta
-- tabla es la que lleva el MOTIVO y el alcance del lote, y se escribe con el repositorio de dominio, así que su
-- creación entra a la bitácora (invariante 9) en la misma transacción que las anulaciones.
-- - `alcance`: `usuario` (los QR vigentes de uno), `rama` (de él y de todo lo que cuelga de él) o `cuenta` (todos).
-- - `usuario_objetivo_id`: el usuario (o la raíz de la rama); NULL con `alcance = 'cuenta'`.
-- - `usuarios_alcanzados` y `qr_anulados`: cuántos usuarios cubrió el pedido y cuántos QR vigentes se anularon.
-- Los QR anulados no reviven: no hay operación inversa.
CREATE TABLE anulaciones_masivas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  alcance VARCHAR(10) NOT NULL,
  usuario_objetivo_id BIGINT UNSIGNED NULL,
  motivo VARCHAR(200) NOT NULL,
  usuarios_alcanzados INT UNSIGNED NOT NULL,
  qr_anulados INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_anulaciones_masivas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_anulaciones_masivas_objetivo FOREIGN KEY (usuario_objetivo_id) REFERENCES usuarios (id),
  CONSTRAINT ck_anulaciones_masivas_alcance CHECK (alcance IN ('usuario', 'rama', 'cuenta')),
  CONSTRAINT ck_anulaciones_masivas_objetivo CHECK (
    (alcance = 'cuenta' AND usuario_objetivo_id IS NULL) OR (alcance <> 'cuenta' AND usuario_objetivo_id IS NOT NULL)
  ),
  CONSTRAINT ck_anulaciones_masivas_motivo CHECK (CHAR_LENGTH(TRIM(motivo)) > 0),
  KEY idx_anulaciones_masivas_tenant (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE anulaciones_masivas;
