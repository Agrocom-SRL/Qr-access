# ADR 0008 — Diseño del QR: token emitido por un usuario, de un solo uso y con vencimiento

**Estado:** Aceptada (2026-10-08) · Reemplaza la propuesta anterior (QR personal dinámico tipo TOTP), que ya no corresponde: quien entra no tiene la app (dudas D-01, D-09 y D-11).

## Contexto

Un usuario de una cuenta (administrador o quien tenga el permiso) genera un QR en la app y se lo envía a la persona que va a entrar. Esa persona no tiene usuario ni app, y no se la registra. En la puerta, un lector conectado al ESP32 lee el QR y la placa le pregunta a la API si puede abrir (ADR 0009). El QR vale por un día, se consume con el primer uso y al final del día se da de baja, usado o no.

Un QR viaja como imagen por WhatsApp o correo: se puede reenviar y fotografiar. Por eso no puede contener nada que abra sin pasar por el servidor, y tiene que dejar de servir apenas se usa.

## Decisión

1. **El QR es un token aleatorio**: 128 bits de `crypto.randomBytes`, en base64url (22 caracteres). El texto del QR es `AQ1.<token>`: corto, para que un lector económico lo lea rápido. No lleva datos de la cuenta, de la puerta ni del vencimiento.
2. **En la base solo queda su hash** (`SHA-256` del token, índice único). Con 128 bits de entropía no hace falta sal ni argon2. Un volcado de la base no permite reconstruir ningún QR vigente. El token en claro existe solo en la respuesta de la emisión, y la app lo convierte en imagen.
3. **Emisión** (`POST /api/v1/qr-accesos`, permiso `accesos.qr.emitir`): el usuario elige la puerta o las puertas de su cuenta (D-17) y, si quiere, una vigencia menor y una etiqueta libre (D-21). La API calcula `vence_at`: por defecto, el fin del día local del sitio (`sitios.zona_horaria`, D-16), sin pasar nunca la vigencia máxima del plan (ADR 0017). La cantidad de QR es ilimitada.
4. **Validación** (`POST /api/v1/dispositivos/validaciones`, autenticada con la credencial del dispositivo, ADR 0004 §8). Pasos, en orden:
   1. formato `AQ1.` y largo exacto;
   2. hash del token, buscado **solo dentro de la cuenta del dispositivo**;
   3. QR no anulado ni dado de baja;
   4. `vence_at` posterior a la hora del servidor;
   5. la puerta del dispositivo es una de las del QR;
   6. suscripción de la cuenta vigente (ADR 0017);
   7. **consumo atómico**: `UPDATE … SET usado_at = ?, usado_dispositivo_id = ? WHERE id = ? AND usado_at IS NULL`, que tiene que afectar exactamente una fila. Si dos lectores leen el mismo QR a la vez, solo uno abre.
5. La respuesta es siempre `200` con `abrir: true|false` y un `motivo_code` (`qr.vencido`, `qr.usado`, `qr.desconocido`, `qr.otra_puerta`, `suscripcion.vencida`…). **Todo intento** queda en `eventos_acceso` (ADR 0007), incluido un token desconocido, guardando su hash y nunca el texto.
6. **Anulación**: quien emitió el QR, o un administrador, puede anularlo antes de que se use (`anulado_at`).
7. **Cierre del día**: un proceso del sistema da de baja (soft delete) los QR vencidos, usados o no, y guarda la autoría `sistema`. Los eventos que los referencian se mantienen.

## Alternativas descartadas

- **QR personal dinámico (TOTP) desde la app**: exige que quien entra tenga la app y una sesión. No corresponde a este flujo.
- **QR firmado autocontenido (JWT o HMAC con datos y vencimiento)**: más largo y difícil de leer para un módulo económico. Además, el anti-reuso igual necesita la base: no aporta nada.
- **Guardar el token cifrado** (AES) en lugar del hash: el sistema no necesita volver a leer el token; con el hash basta para validar, y un volcado de la base no expone nada.
- **Validación local en el ESP32**: una placa robada expondría la lista de QR vigentes; además, sin red no se abre (D-05).

## Consecuencias

- El token en claro no se puede recuperar. Si el usuario pierde la imagen, anula ese QR y emite otro.
- La app comparte la imagen del QR (D-18); el texto del token no se guarda en el teléfono más allá de esa pantalla.
- Una captura reenviada sirve una sola vez y solo hasta su vencimiento: el riesgo queda acotado a ese primer uso.
- Tests obligatorios: QR vencido, usado, anulado, de otra cuenta, de otra puerta, con suscripción vencida y dos validaciones concurrentes del mismo QR → una sola abre, y todos los intentos quedan registrados.
