---
name: generacion-qr-segura
description: Reglas para generar, compartir, reutilizar, anular y revocar QR en AGROCOM Acceso en todas las capas (API, base de datos, app, panel y firmware) — token de un solo uso, hash en base, QR propio reutilizable, revocación en cascada, idempotencia, etiqueta, estados restringido y suspendido, confirmación de apertura y estado de las placas. Usar antes de tocar generar-qr, validar-qr, "Mi QR", "Mis QR", compartir un QR o cualquier regla de vigencia.
---

# Generación segura de QR

Fuentes: ADR 0008 (diseño del QR), ADR 0030 (topes y abuso), ADR 0031 (endurecimiento, parcialmente aceptado; estados de placa y confirmación de apertura en §E) y ADR 0032 (concurrencia y registro de lecturas, propuesta). Si un punto del ADR 0031 sigue "propuesta", confirma con Miguel antes de implementarlo.

## Lo que nunca cambia

1. El QR es `AQ1.` + 22 caracteres base64url (128 bits). No lleva datos de cuenta, puerta ni vencimiento. En la base solo vive `SHA-256(token)`. Nunca se loguea el token en claro.
2. Un solo uso, consumo atómico (`UPDATE … WHERE usado_at IS NULL`, una fila). Nada de QR multiuso ni permanente.
3. La puerta abre solo con `abrir: true` del servidor; el firmware no evalúa vencimientos.
4. **Validar nunca se limita** por cuota, bolsa ni cuenta suspendida de generación (ADR 0030 §1). Los límites van solo en `generar-qr`.
5. Todo intento de validación va a `lecturas`, también los nuevos motivos.

## Estados y cascada (ADR 0031 §0–2, aceptado)

- Vocabulario (ADR 0033 §1): **restringido** < **suspendido** < **eliminado**. Dos niveles de baja: *restringido* o leve (sigue con sesión, no genera, **sus QR ya generados siguen vivos** hasta su vencimiento; `qr.generacion_restringida`) y *suspendido* o crítico, o eliminado (sesiones cerradas, QR vigentes anulados y toda su rama o cuenta suspendida).
- Un superior arrastra a su rama; suspender la cuenta alcanza a todos. Al validar, el generador **y sus superiores** deben estar activos y la cuenta no suspendida (`qr.generador_suspendido`).
- Idempotencia: la app guarda la solicitud pendiente con su `Idempotency-Key` en caché local y reintenta sola.
- Repeticiones (ADR 0032): mismo dispositivo y mismo QR ya permitido dentro de 15 s → `abrir: true` sin consumir de nuevo; rechazos idénticos dentro de 60 s se insertan con `repetido_de_id`, nunca se editan ni se omiten.
- **La vida de un QR es solo su `vence_at`**: no hay «válido desde» ni franjas dentro del día.
- Descartado: `FLAG_SECURE` y la imagen con vencimiento como antifraude; el generador responde por su QR y la bitácora lo prueba.

## Checklist por capa

**Modelo de datos (`modelo-datos`)**: una migración por tabla; fechas `DATETIME(3)` UTC; columnas nuevas (`sensible`, `idempotency_key_hash`, diagnóstico del latido) y la tabla `confirmaciones_apertura` con su rollback; índices para los topes (conteo por usuario y día, pendientes por usuario); tablas de rechazos o notificaciones con `tenant_id`, autoría y solo inserción cuando corresponda.

**API (`backend`, `api-rest`)**:
- `generar-qr` aplica, en este orden: permiso, suscripción vigente, cuenta no suspendida de generación, topes (`qr.limite_diario`, `qr.limite_pendientes`, `qr.limite_propios_sin_uso`), reutilización del QR propio activo (`reutilizado: true`, sin crear ni anular), vigencia contra el menor máximo (plan, cuenta, puerta), etiqueta si es obligatoria, límite de puertas.
- `Idempotency-Key` en `POST /qr-accesos`: mismo resultado, sin doble consumo de cupo.
- Revocación en cascada: baja de usuario, regenerar PIN, cerrar sesiones o quitar rol anulan sus QR vigentes en la misma transacción; además `validar-qr` comprueba que el generador siga activo y con permiso.
- Errores con código RFC 9457 y `Retry-After` en 429; nunca texto para el usuario. Todo código nuevo es adición compatible a `/api/v1`.
- Consultas de QR siempre por `RepositorioDeCuenta`; cuenta A pidiendo un QR de B → 404.

**App Flutter (`app-flutter`)**: copia local del token solo en almacenamiento seguro (Keystore/Keychain; en web, en memoria) hasta el vencimiento, borrada al anular; al reabrir "Mi QR" se consulta el estado antes de mostrarlo; "Mi QR" con `FLAG_SECURE` (Android) y ocultamiento en capturas (iOS); la imagen compartida lleva vencimiento y etiqueta visibles; textos de errores (`qr.*`) en los ARB con tuteo; sin colores ni tamaños fuera de los tokens; reintentos con `Idempotency-Key`.

**Panel web (`web-react`)**: anulación masiva, cuenta suspendida de generación y contadores de rechazos por motivo, solo super admin; textos en `web/src/l10n/`.

**Firmware (`firmware`)**: no guarda ni compara QR, no evalúa tiempos; sin respuesta válida, no abre. Nuevo: el latido informa lector y sensor de puerta, y tras `abrir: true` reporta si la puerta se abrió (`confirmada`, `no_confirmada`, `sin_sensor`); solo lee pines y reporta.

## Tests mínimos (los exige el validador)

QR vencido, usado, anulado, de otra cuenta, de otra puerta, de generador inactivo o suspendido (o de un superior); dos validaciones concurrentes → una abre; baja de usuario anula sus QR; reintento idempotente; QR propio reutilizado no crea ni anula nada; topes → 429 con su `code` y sin bloqueo al día siguiente; la validación no se ve afectada por ningún tope de generación.

## Qué no hacer

Guardar el token en claro o cifrado en el servidor; enlaces web públicos al QR; evaluar reglas de tiempo en el firmware; bloquear al usuario por un tope; saltar `RepositorioDeCuenta` para contar.
