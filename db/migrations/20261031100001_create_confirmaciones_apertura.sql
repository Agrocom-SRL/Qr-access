-- migrate:up
-- Confirmación de la apertura (ADR 0031 §18, plan W10): lo que pasó DESPUÉS de que el servidor ordenó abrir. Cada fila
-- cuelga del `eventos_acceso` permitido que dio la orden y dice si la puerta de verdad se abrió. Es de SOLO
-- INSERCIÓN, como el evento al que se enlaza (invariante 4): nunca se edita; una confirmación tardía es otra fila.
-- - `origen = 'placa'`: la placa informó (`POST /dispositivos/confirmaciones`). `origen = 'servidor'`: la placa no
--   dijo nada a tiempo y el detector dejó constancia (`sin_confirmacion` / `sin_respuesta`).
-- - `resultado`: `ejecutada` (el sensor vio abrir la puerta), `fallida` (la orden se dio y la puerta no se abrió, o
--   quedó mal) o `sin_confirmacion` (no hay cómo saberlo: la placa no tiene sensor o no contestó). La equivalencia
--   con el ADR 0031 §18 es `confirmada` = `ejecutada`, `no_confirmada` = `fallida`, `sin_sensor` = `sin_confirmacion`.
-- - El estado EFECTIVO de un evento es el de la fila de la placa si existe y, si no, el de la constancia del servidor:
--   una confirmación tardía de la placa se impone a la constancia `sin_respuesta`, aunque se haya escrito antes.
-- - `uq_confirmaciones_apertura_origen`: a lo sumo una fila de la placa y una del servidor por evento. Repetir el
--   mismo informe (reintento de la placa) no crea nada: la inserción es idempotente.
-- - `registrada_at` es la hora del servidor; `reportado_en_dispositivo_at` es la del reloj de la placa, solo informativa.
-- Sin autoría ni soft delete ni bitácora (perfil `solo_insercion`): es un registro de hechos, como `eventos_acceso`.
CREATE TABLE confirmaciones_apertura (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  evento_acceso_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  origen VARCHAR(10) NOT NULL,
  resultado VARCHAR(20) NOT NULL,
  causa VARCHAR(30) NOT NULL,
  reportado_en_dispositivo_at DATETIME(3) NULL,
  registrada_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_confirmaciones_apertura_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_confirmaciones_apertura_evento FOREIGN KEY (evento_acceso_id) REFERENCES eventos_acceso (id),
  CONSTRAINT fk_confirmaciones_apertura_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_confirmaciones_apertura_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT ck_confirmaciones_apertura_origen CHECK (origen IN ('placa', 'servidor')),
  CONSTRAINT ck_confirmaciones_apertura_resultado CHECK (resultado IN ('ejecutada', 'fallida', 'sin_confirmacion')),
  CONSTRAINT ck_confirmaciones_apertura_causa CHECK (
    (resultado = 'ejecutada' AND causa = 'puerta_abrio')
    OR (resultado = 'fallida' AND causa IN ('puerta_no_abrio', 'puerta_no_cerro', 'rele_no_accionado'))
    OR (resultado = 'sin_confirmacion' AND causa IN ('sin_sensor', 'sin_respuesta'))
  ),
  CONSTRAINT ck_confirmaciones_apertura_servidor CHECK (origen = 'placa' OR causa = 'sin_respuesta'),
  UNIQUE KEY uq_confirmaciones_apertura_origen (evento_acceso_id, origen),
  KEY idx_confirmaciones_apertura_reciente (tenant_id, registrada_at),
  KEY idx_confirmaciones_apertura_dispositivo (dispositivo_id, registrada_at),
  KEY idx_confirmaciones_apertura_puerta (puerta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE confirmaciones_apertura;
