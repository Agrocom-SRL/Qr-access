# ADR 0024 — Comprobantes de pago y almacenamiento de archivos

**Estado:** Aceptada (2026-10-12)

## Contexto

El pago manual de una cuenta (ADR 0022) se hace por transferencia, QR o efectivo. Para las dos primeras, quien cobra necesita dejar el comprobante en el sistema y dejar constancia de que el dinero llegó. El ADR 0015 previó la subida de archivos solo para fotos de personas y logos; esto es el primer archivo real de V1.

## Decisión

- **Dónde se guarda:** la interfaz `Almacenamiento` (`api/src/platform/almacenamiento/`) con una implementación en disco. En docker es el volumen `archivos` (`ARCHIVOS_RUTA=/archivos`); en producción se cambia por una implementación compatible con S3 sin tocar los módulos. La base guarda solo la ruta relativa (`comprobantes.ruta`), con nombre aleatorio (`comprobantes/<uuid>.<ext>`), nunca el que trae el cliente.
- **Cómo se sube:** `POST /api/v1/plataforma/comprobantes` con el archivo crudo como cuerpo (`Content-Type: image/jpeg|png|webp` o `application/pdf`), máximo 5 MB. Se evita `multipart` porque es un solo archivo por recurso y no suma dependencias; se aparta del ADR 0015 solo en eso. Responde `{ id, tipo_mime, tamano }`.
- **Validación por contenido:** el tipo se decide por los primeros bytes (JPEG, PNG, WEBP, PDF), nunca por la extensión ni por el `Content-Type`. Un archivo de otro tipo da `comprobante.formato_invalido`; uno vacío, `comprobante.vacio`; uno de más de 5 MB, `comprobante.muy_grande` (413).
- **Sin reprocesado:** a diferencia de las fotos de personas, un comprobante bancario se conserva tal cual (es un documento de respaldo contable); no se recodifica. Se entrega con `X-Content-Type-Options: nosniff`.
- **Acceso:** `GET /api/v1/plataforma/comprobantes/{id}` con la sesión del super admin (`suscripciones.suscripcion.ver`); nunca desde una carpeta pública. La tabla `comprobantes` es de plataforma (sin `tenant_id`) porque se sube antes de que el pago o la cuenta existan; el pago la referencia (`pagos.comprobante_id`) y de él se deduce la cuenta. Solo el super admin llega a ella.
- **El pago:** `comprobante_id` es obligatorio si el medio es `transferencia` o `qr` y no va en `efectivo` (validado en el contrato, 400). El alta de una cuenta con el primer pago registrado usa los mismos campos. *(Ajustado el 2026-10-22: el medio `deposito` pasó a `qr`, y `banco` y `cuenta_destino` dejaron de pedirse porque AGROCOM registra pagos hechos a sí misma; las columnas quedan como históricas. La `referencia` es opcional: es un pago completo, no por cuotas.)*
- **Archivos huérfanos:** si el pago no llega a registrarse, el archivo queda sin referencia pero inofensivo; una purga periódica queda pendiente.

## Consecuencias

- Hay un volumen más que respaldar.
- Las cuentas bancarias y los QR de cobro de AGROCOM se cargan aparte y se muestran al activar una cuenta (ADR 0029).
