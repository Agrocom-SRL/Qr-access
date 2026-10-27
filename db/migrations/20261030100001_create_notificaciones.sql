-- migrate:up
-- Bandeja de notificaciones (ADR 0030 §6, ADR 0031 §18): una fila por destinatario. La cuenta ve las suyas
-- (`tenant_id` = la cuenta, para el propietario) y AGROCOM las suyas (`tenant_id` NULL, `cuenta_id` dice de qué
-- cuenta hablan). Un aviso AGRUPADO (p. ej. varias placas caídas de un mismo sitio) es UNA fila: mientras el
-- incidente siga abierto (`abierta = 1`) se actualiza su lista de miembros en vez de crear otra; al resolverse se
-- cierra. El índice único `uq_notificaciones_incidente` impide dos incidentes abiertos del mismo grupo para un
-- destinatario, aunque dos procesos compitan. `datos` no lleva secretos (ni token, ni credenciales, ni PIN).
-- Sin bitácora (perfil `dominio_sin_bitacora`): es un derivado del estado de las placas y leerlo o descartarlo
-- es estado de lectura de cada persona, no un cambio de negocio.
CREATE TABLE notificaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  cuenta_id BIGINT UNSIGNED NOT NULL,
  destinatario_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  severidad VARCHAR(10) NOT NULL,
  sitio_id BIGINT UNSIGNED NULL,
  agrupacion_clave VARCHAR(100) NOT NULL,
  clave_unica VARCHAR(120) NULL,
  abierta TINYINT(1) NOT NULL DEFAULT 0,
  cantidad INT UNSIGNED NOT NULL DEFAULT 1,
  miembros JSON NOT NULL,
  datos JSON NOT NULL,
  novedad_at DATETIME(3) NOT NULL,
  resuelta_at DATETIME(3) NULL,
  leida_at DATETIME(3) NULL,
  descartada_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  incidente_abierto TINYINT GENERATED ALWAYS AS (IF(abierta = 1 AND deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_notificaciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_notificaciones_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas (id),
  CONSTRAINT fk_notificaciones_destinatario FOREIGN KEY (destinatario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_notificaciones_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id),
  CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada'
  )),
  CONSTRAINT ck_notificaciones_severidad CHECK (severidad IN ('info', 'aviso', 'critica')),
  CONSTRAINT ck_notificaciones_abierta CHECK (abierta IN (0, 1)),
  CONSTRAINT ck_notificaciones_ambito CHECK (tenant_id IS NULL OR tenant_id = cuenta_id),
  UNIQUE KEY uq_notificaciones_incidente (destinatario_id, agrupacion_clave, incidente_abierto),
  UNIQUE KEY uq_notificaciones_clave (destinatario_id, clave_unica),
  KEY idx_notificaciones_bandeja (destinatario_id, descartada_at, leida_at, novedad_at),
  KEY idx_notificaciones_cuenta (cuenta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE notificaciones;
