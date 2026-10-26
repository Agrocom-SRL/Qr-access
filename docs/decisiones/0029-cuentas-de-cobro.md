# ADR 0029 — Cuentas de cobro de AGROCOM

**Estado:** Aceptada (2026-10-22)

## Contexto

AGROCOM cobra las suscripciones por transferencia, QR o efectivo (ADR 0022). El registro de un pago ya no pide el banco ni la cuenta de destino (ADR 0024, ajuste del 2026-10-22): AGROCOM registra pagos hechos a sí misma, y no tiene sentido elegir cada vez entre sus propias cuentas. Pero quien activa una cuenta necesita saber a dónde mandar el dinero, así que esos datos se cargan una sola vez.

## Decisión

- **Tabla `cuentas_de_cobro`** (de plataforma, sin `tenant_id`; ficha en `docs/modelo-datos/tablas/24_cuentas_de_cobro.md`): `metodo` (`transferencia` o `qr`), `banco`, y según el método `titular`, `numero_cuenta` y `tipo_cuenta` (ahorro o corriente), o `imagen_id` con el QR. Más `nota` opcional y `activo`. Soft delete y autoría como toda tabla de dominio; los cambios van a la bitácora (tabla relevante `cuentas_de_cobro`).
- **Reglas en la base y en la acción:** una cuenta bancaria exige titular y número; un QR exige su imagen, que no puede ser un PDF. El mismo banco y número no se repiten entre las vigentes.
- **El QR es una imagen del almacén de archivos** (`comprobantes`, ADR 0024): se sube con `POST /plataforma/comprobantes` y la cuenta la referencia por id. Se entrega con la sesión del super admin, nunca por una URL pública.
- **API** (módulo `suscripciones`): `GET/POST /plataforma/cuentas-de-cobro`, `PATCH/DELETE /plataforma/cuentas-de-cobro/{id}`. Permisos de plataforma `suscripciones.cobro.ver|crear|editar|eliminar`, que recibe el super admin. El método no se cambia al editar: se crea otra cuenta.
- **Panel:** página "Cuentas de cobro" (se llega desde Cobranza) para agregar, editar, activar o desactivar y eliminar. Una desactivada deja de mostrarse pero no se pierde.
- **Dónde se muestran:** al registrar el pago de **alta** de una cuenta (el paso de confirmación del alta con el pago ahora y la pantalla de registrar el primer pago), según el medio elegido: las cuentas bancarias activas con transferencia y los QR activos con QR. No se muestran con efectivo, ni en renovaciones o mejoras de plan. Si la lista no carga (por ejemplo, sin permiso), no se muestra nada: registrar el pago no depende de ella.

## Consecuencias

- Los pagos ya registrados no referencian estas filas: borrar o desactivar una cuenta no cambia el historial.
- Es un dato de plataforma que ve y cambia solo el super admin; ninguna cuenta cliente lo lee.
- Pendiente: mostrar estas cuentas a la propia empresa cliente (por ejemplo, en su pantalla de suscripción) cuando haya un panel para ella.
