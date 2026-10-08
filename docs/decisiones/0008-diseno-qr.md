# ADR 0008 — Diseño del QR: token dinámico firmado, de un solo uso y con vencimiento

**Estado:** Propuesta (2026-10-08) — confirmar el flujo con el cliente (dudas D-01 y D-02)

## Contexto

Un QR es fácil de fotografiar y reenviar. Si el QR fuera un identificador fijo, una captura de pantalla daría acceso para siempre. El lector de la puerta es un módulo QR conectado al ESP32 (ADR 0009), y el teléfono de la persona puede no tener datos en el momento de entrar.

## Decisión

### Flujo principal (recomendado): la persona muestra, la puerta lee

1. La persona inicia sesión en la app; la API le entrega una **credencial QR** con un **secreto propio** (32 bytes), que la app guarda en almacenamiento seguro (en web, solo en memoria de la sesión). En la base, el secreto se guarda **cifrado** (AES-256-GCM con clave maestra del entorno).
2. La app genera el QR **sin red**, al estilo TOTP: `AQ1.<credencial_id>.<paso>.<firma>`, donde `paso = floor(unix / 30)` y `firma = base64url(HMAC-SHA256(secreto, "AQ1|credencial_id|paso"))[0..16]`. Se regenera cada 30 s con cuenta regresiva visible.
3. El lector de la puerta lee el texto y el firmware lo envía a `POST /api/v1/dispositivos/validaciones`.
4. La API verifica, en orden: formato → credencial existente, activa y de la **misma cuenta** que el dispositivo → firma → `paso` dentro de ±1 del actual → **no usado**: inserta en `qr_usos (credencial_id, paso)` con índice único (el segundo intento falla) → persona activa → **regla de acceso** para esa puerta, día y hora local del sitio → (opcional) antipassback.
5. Responde `abrir: true|false` y **siempre** registra el intento en `eventos_acceso` (ADR 0007).

### Invitaciones (visitantes sin app)

Un usuario con permiso crea una invitación para una puerta y una ventana de tiempo; la API genera un token aleatorio de 128 bits, de **un solo uso** (o N usos explícitos), que se comparte como enlace a una página web que muestra el QR (`AQI.<token>`). En la base solo queda su hash.

### Escáner de guardia (complemento)

El rol Guardia puede escanear con la app (móvil o web) un QR en una puerta sin lector; la app llama a `POST /api/v1/accesos/validaciones` con la puerta elegida y la misma lógica del punto 4.

## Alternativas descartadas

- **QR fijo por persona**: una captura sirve para siempre.
- **QR fijo en la puerta que el teléfono escanea** (y la API ordena abrir): exige que el teléfono tenga datos y que el servidor llegue al dispositivo en tiempo real (MQTT o WebSocket). Queda como evolución si se pide "abrir desde la app" (duda D-02).
- **Validación local en el ESP32 con clave compartida**: una placa robada expondría la clave de todas las credenciales.
- **JWT completo dentro del QR**: demasiado largo para leerse rápido con un módulo económico.

## Consecuencias

- Con una ventana de ±1 paso, un QR vale ~60-90 s, y el registro de usos lo invalida al primer uso.
- El reloj del teléfono puede estar desfasado: la API informa el desfase al iniciar sesión y la app lo corrige.
- Revocar la credencial (o rotar su secreto) invalida de inmediato todos los QR de esa persona.
