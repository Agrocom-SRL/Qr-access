-- migrate:up
-- El NIT y el teléfono de contacto pasan a ser opcionales y el contacto gana apellido.
-- Las filas existentes quedan con apellido vacío; el nombre guardado se conserva tal cual.
ALTER TABLE cuenta_datos_empresa
  MODIFY COLUMN nit VARCHAR(20) NULL,
  MODIFY COLUMN contacto_telefono VARCHAR(30) NULL,
  ADD COLUMN contacto_apellido VARCHAR(120) NOT NULL DEFAULT '' AFTER contacto_nombre;

-- migrate:down
UPDATE cuenta_datos_empresa SET nit = '' WHERE nit IS NULL;
UPDATE cuenta_datos_empresa SET contacto_telefono = '' WHERE contacto_telefono IS NULL;
ALTER TABLE cuenta_datos_empresa
  DROP COLUMN contacto_apellido,
  MODIFY COLUMN nit VARCHAR(20) NOT NULL,
  MODIFY COLUMN contacto_telefono VARCHAR(30) NOT NULL;
