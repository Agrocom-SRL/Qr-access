-- migrate:up
-- Constancia de que una señal ya se llevó a la bandeja (ADR 0030 §5: «no se avisa dos veces por el mismo evento en el
-- mismo día», ola W12). Cada detector de señales (uso masivo, uso imposible, QR reenviado, PIN compartido, bolsa
-- mensual, flujo atípico) arma una `clave_unica` con lo que identifica el hecho y el día (p. ej. `uso_masivo:<usuario>:
-- 2026-11-10`, `bolsa.superada:2026-11-10`); si la clave ya está, no vuelve a avisar. El UNIQUE `(tenant_id, clave_unica)`
-- es el árbitro: la constancia y el encolado del aviso van en la MISMA transacción, así que o quedan los dos o ninguno.
-- Perfil `solo_insercion` (no se edita ni se borra; sin autoría ni bitácora: la constancia es el rastro).
-- `tipo` es el de la señal (`uso_masivo`, `bolsa.aviso`, `flujo_atipico`...); `usuario_id` solo cuando la señal es de un usuario.
-- No guarda datos del hecho (cantidades, IP): eso vive en el incidente, en el aviso de la bandeja o en el registro de origen.
CREATE TABLE avisos_de_senal (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  clave_unica VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_avisos_de_senal_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_avisos_de_senal_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  UNIQUE KEY uq_avisos_de_senal_clave (tenant_id, clave_unica),
  KEY idx_avisos_de_senal_creado (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE avisos_de_senal;
