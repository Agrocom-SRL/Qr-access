# Dudas y ambigüedades

Formato: **D-NN** · pregunta · por qué importa · propuesta · estado. Al cerrarla: fecha, respuesta y fuente.

| # | Pregunta | Por qué importa | Propuesta | Estado |
|---|---|---|---|---|
| D-01 | ¿El lector va en la puerta (la persona muestra su QR) o el QR está fijo en la puerta y la persona lo escanea con el teléfono? | Cambia el hardware, el firmware y si hace falta comunicación servidor → dispositivo | Lector en la puerta + QR dinámico en la app (ADR 0008) | Abierta |
| D-02 | ¿Se necesita abrir una puerta de forma remota desde la app (sin QR)? | Exige MQTT o WebSocket hacia el dispositivo | Fuera de V1 | Abierta |
| D-03 | ¿Qué placa y lector se van a comprar? ¿Ya hay hardware? | Pines, UART, alimentación | ESP32 DevKitC + GM65/GM861S (ver `docs/hardware/`) | Abierta |
| D-04 | ¿Qué tipo de cerradura tienen las puertas (electroimán, cerradero, motor)? ¿Fail-safe o fail-secure? | Lógica del relé y normas de evacuación | Parámetro por puerta | Abierta |
| D-05 | ¿Las puertas deben seguir funcionando sin internet? | Si sí, hace falta validación local con lista firmada (ADR nuevo) | V1: sin red no abre (solo salida física) | Abierta |
| D-06 | ¿Cuánto tiempo se guardan los eventos de acceso? | Volumen de `eventos_acceso` y normativa de datos personales | 2 años y archivo | Abierta |
| D-07 | ¿Se guarda la foto de la persona para que el guardia la vea? | Uploads (ADR 0015) y datos personales | Sí, opcional | Abierta |
| D-08 | ¿Hex oficial del verde de marca (bandera de Santa Cruz)? | Rampa y contraste del sistema de diseño | `#007A33` provisional | Abierta |
| D-09 | ¿Toda persona con acceso tiene usuario en la app, o hay personas sin app (solo invitación o guardia)? | Relación `personas`–`usuarios` | Persona con `usuario_id` opcional | Abierta |
| D-10 | ¿Se requiere antipassback (no entrar dos veces sin salir)? | Exige lector de salida y estado por persona | Fuera de V1 | Abierta |
| D-11 | ¿Las invitaciones a visitantes entran en V1? | Alcance | Sí, de un solo uso | Abierta |
| D-12 | ¿Una cuenta puede tener sitios en otra zona horaria? | Evaluación de horarios | `zona_horaria` por sitio, por defecto `America/La_Paz` | Abierta |
| D-13 | ¿Dónde se despliega (servidor propio, VPS, nube)? ¿Quién gestiona el DNS de `agrocom.com.bo`? | Deploy, TLS y OTA | VPS con Docker Compose + Nginx + Let's Encrypt | Abierta |
