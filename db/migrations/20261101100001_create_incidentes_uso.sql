-- migrate:up
-- Incidentes de uso (ADR 0033 §4, ola W11): un hecho sospechoso o una falta de un usuario de la cuenta, creado por el
-- sistema (cuando salta una señal, ADR 0030 §4 y 0031 §19) o por una persona que administra la rama. Es el HECHO: de
-- SOLO INSERCIÓN, nunca se edita ni se borra (como `eventos_acceso`). Qué se decidió después (descartado, confirmado,
-- pendiente) es otra fila, en `resoluciones_de_incidente`.
-- - `tipo`: la lista cerrada del ADR 0033 §4.1. `gravedad`: `baja`, `media` o `alta` (supuesto: el ADR no fija la escala).
-- - `origen`: `sistema` (sin autor) o `persona` (`registrado_por` obligatorio, `descripcion` opcional).
-- - `evidencia`: JSON `{"qr_ids":[...],"evento_acceso_ids":[...],"evento_limite_ids":[...]}`. Solo IDS: jamás el token
--   del QR ni su hash (invariante 6). La API comprueba que los ids existan en la cuenta antes de escribirlos.
-- - `clave_unica`: idempotencia de los incidentes del sistema (p. ej. `generacion_ruidosa:<usuario>:<día>`): repetir la
--   detección no crea otro. NULL en los de una persona.
-- - `ocurrido_at` es cuándo pasó (UTC); entra en la ventana de la reincidencia. `created_at`, cuándo se registró.
-- Perfil `solo_insercion`: sin autoría ni soft delete ni bitácora; el propio registro (con `registrado_por`) es el rastro.
CREATE TABLE incidentes_uso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  gravedad VARCHAR(10) NOT NULL,
  origen VARCHAR(10) NOT NULL,
  registrado_por BIGINT UNSIGNED NULL,
  descripcion VARCHAR(300) NULL,
  evidencia JSON NOT NULL,
  clave_unica VARCHAR(100) NULL,
  ocurrido_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_incidentes_uso_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_incidentes_uso_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_incidentes_uso_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuarios (id),
  CONSTRAINT ck_incidentes_uso_tipo CHECK (tipo IN (
    'uso_masivo', 'uso_imposible', 'pin_compartido', 'qr_reenviado', 'generacion_ruidosa', 'perdida_o_robo', 'otro'
  )),
  CONSTRAINT ck_incidentes_uso_gravedad CHECK (gravedad IN ('baja', 'media', 'alta')),
  CONSTRAINT ck_incidentes_uso_origen CHECK (
    (origen = 'sistema' AND registrado_por IS NULL) OR (origen = 'persona' AND registrado_por IS NOT NULL)
  ),
  UNIQUE KEY uq_incidentes_uso_clave (tenant_id, clave_unica),
  KEY idx_incidentes_uso_usuario (tenant_id, usuario_id, ocurrido_at),
  KEY idx_incidentes_uso_reciente (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE incidentes_uso;
