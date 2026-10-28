-- migrate:up
-- Sensor de puerta y estado de la ejecución de aperturas (ADR 0031 §18, plan W10).
-- - `sensor_instalado`: ¿esta puerta tiene el contacto magnético (reed) conectado y verificado? CONFIGURACIÓN, no
--   telemetría: una placa no puede saberlo sola (el pin con pull-up lee igual cableado que al aire). Por omisión 0
--   (sin sensor): hasta que alguien de AGROCOM lo habilite, la placa informa `sin_sensor` y no se inventa ni un éxito
--   ni una falla. Nace en 0 porque la polaridad del reed está pendiente de confirmar en campo.
-- - `sensor_habilitado_at`: cuándo se habilitó el sensor (hora del servidor; NULL mientras no lo está). El detector de
--   aperturas fallidas solo juzga aperturas ordenadas desde ese instante: habilitar el sensor no fabrica fallas
--   retroactivas de las últimas horas, cuando la placa aún no podía informar.
-- - `sensor_abierto_nivel`: nivel (`alto` o `bajo`) que lee el pin del sensor cuando la puerta está ABIERTA. Por
--   omisión `alto`, el valor con que hoy compila el firmware (`SENSOR_PUERTA_NIVEL_ABIERTA HIGH`); es una
--   suposición hasta confirmar la polaridad. La placa lo recibe en `GET /dispositivos/configuracion`.
-- - `sensor_estado` / `sensor_informado_at`: lo que informó el último latido (`abierta`, `cerrada`, `sin_sensor`);
--   NULL = el firmware no lo informa. Telemetría: no pasa por la bitácora.
-- - `apertura_fallida`: 1 mientras la puerta está en el grupo de «aperturas que fallan» del detector (varias
--   fallas en la ventana). Lo escribe solo el detector, con compare-and-set, para avisar UNA vez por cambio.
ALTER TABLE dispositivos
  ADD COLUMN sensor_instalado TINYINT(1) NOT NULL DEFAULT 0 AFTER en_observacion,
  ADD COLUMN sensor_habilitado_at DATETIME(3) NULL AFTER sensor_instalado,
  ADD COLUMN sensor_abierto_nivel VARCHAR(5) NOT NULL DEFAULT 'alto' AFTER sensor_habilitado_at,
  ADD COLUMN sensor_estado VARCHAR(12) NULL AFTER sensor_abierto_nivel,
  ADD COLUMN sensor_informado_at DATETIME(3) NULL AFTER sensor_estado,
  ADD COLUMN apertura_fallida TINYINT(1) NOT NULL DEFAULT 0 AFTER sensor_informado_at,
  ADD CONSTRAINT ck_dispositivos_sensor_nivel CHECK (sensor_abierto_nivel IN ('alto', 'bajo')),
  ADD CONSTRAINT ck_dispositivos_sensor_estado CHECK (
    sensor_estado IS NULL OR sensor_estado IN ('abierta', 'cerrada', 'sin_sensor')
  );

-- migrate:down
ALTER TABLE dispositivos
  DROP CONSTRAINT ck_dispositivos_sensor_estado,
  DROP CONSTRAINT ck_dispositivos_sensor_nivel,
  DROP COLUMN apertura_fallida,
  DROP COLUMN sensor_informado_at,
  DROP COLUMN sensor_estado,
  DROP COLUMN sensor_abierto_nivel,
  DROP COLUMN sensor_habilitado_at,
  DROP COLUMN sensor_instalado;
