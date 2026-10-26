-- migrate:up
-- El medio "depósito" desaparece y se agrega el pago por QR. Los depósitos ya registrados pasan a
-- "transferencia" (el comprobante y el monto no cambian). `banco` y `cuenta_destino` quedan como columnas
-- históricas: ya no se piden, porque AGROCOM registra pagos hechos a sí misma.
ALTER TABLE pagos DROP CHECK ck_pagos_medio;
UPDATE pagos SET medio = 'transferencia' WHERE medio = 'deposito';
ALTER TABLE pagos ADD CONSTRAINT ck_pagos_medio CHECK (medio IN ('transferencia', 'qr', 'efectivo'));

-- migrate:down
ALTER TABLE pagos DROP CHECK ck_pagos_medio;
UPDATE pagos SET medio = 'transferencia' WHERE medio = 'qr';
ALTER TABLE pagos ADD CONSTRAINT ck_pagos_medio CHECK (medio IN ('transferencia', 'deposito', 'efectivo'));
