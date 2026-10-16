-- migrate:up
-- Una cuenta nueva nace "pendiente" hasta registrar su primer pago (tipo "alta"): no emite QR ni
-- abre puertas mientras tanto, porque `buscarVigente` solo mira el estado "vigente".
-- La persona responsable de la cuenta también deja su correo (opcional: las filas anteriores no lo tienen).
ALTER TABLE cuenta_datos_empresa
  ADD COLUMN contacto_correo VARCHAR(120) NULL AFTER contacto_telefono;

ALTER TABLE suscripciones
  DROP CHECK ck_suscripciones_estado,
  ADD CONSTRAINT ck_suscripciones_estado
    CHECK (estado IN ('vigente', 'suspendida', 'vencida', 'pendiente'));

ALTER TABLE pagos
  DROP CHECK ck_pagos_tipo,
  ADD CONSTRAINT ck_pagos_tipo CHECK (tipo IN ('alta', 'renovacion', 'mejora_de_plan'));

-- migrate:down
-- Con cuentas "pendientes" o pagos "alta" ya guardados, estas restricciones no se pueden volver a
-- poner: primero hay que registrar el pago de esas cuentas o borrarlas.
ALTER TABLE pagos
  DROP CHECK ck_pagos_tipo,
  ADD CONSTRAINT ck_pagos_tipo CHECK (tipo IN ('renovacion', 'mejora_de_plan'));

ALTER TABLE suscripciones
  DROP CHECK ck_suscripciones_estado,
  ADD CONSTRAINT ck_suscripciones_estado CHECK (estado IN ('vigente', 'suspendida', 'vencida'));

ALTER TABLE cuenta_datos_empresa DROP COLUMN contacto_correo;
