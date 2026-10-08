# Dudas y ambigüedades

Formato: **D-NN** · pregunta · por qué importa · propuesta · estado. Al cerrarla: fecha, respuesta y fuente.

## Abiertas

| # | Pregunta | Por qué importa | Propuesta | Estado |
|---|---|---|---|---|
| D-06 | ¿Cuánto tiempo se guardan los eventos de acceso? | Volumen de `eventos_acceso` y normativa de datos personales | 2 años y archivo | Abierta |
| D-08 | ¿Hex oficial del verde de marca (bandera de Santa Cruz)? | Rampa y contraste del sistema de diseño | `#007A33` provisional | Abierta |
| D-12 | ¿Una cuenta puede tener sitios en otra zona horaria? | Evaluación del vencimiento "fin del día" | `zona_horaria` por sitio, por defecto `America/La_Paz` | Abierta |
| D-13 | ¿Dónde se despliega (servidor propio, VPS, nube)? ¿Quién gestiona el DNS de `agrocom.com.bo`? | Deploy, TLS y OTA | VPS con Docker Compose + Nginx + Let's Encrypt | Abierta |
| D-14 | ¿Qué límites trae cada plan? (dispositivos, puertas, sitios, usuarios, vigencia máxima del QR) ¿Cuántos planes hay? | Tabla `planes` y validaciones de la API (ADR 0017) | Plan con `max_dispositivos`, `max_usuarios`, `max_vigencia_qr_horas`; los QR son ilimitados | Abierta |
| D-15 | ¿Cómo se cobra la suscripción (manual por AGROCOM o pasarela de pago) y qué pasa al vencer? | Alcance V1 y comportamiento de una cuenta morosa | V1: AGROCOM registra el pago a mano; al vencer, la cuenta no emite QR nuevos y sus puertas rechazan con `suscripcion.vencida` | Abierta |
| D-16 | "Tiempo de vida por día": ¿el QR vence a fin del día local del sitio, o 24 h después de emitido? ¿El usuario puede elegir una vigencia menor? | Cálculo de `vence_at` | Por defecto, fin del día local del sitio; el usuario puede acortarla, nunca pasar el máximo del plan | Abierta |
| D-17 | ¿Un QR abre una sola puerta, varias o todas las de la cuenta? | Relación QR–puertas y anti-reuso | El usuario elige una o más puertas de su cuenta al emitirlo | Abierta |
| D-18 | ¿Cómo le llega el QR a la persona que entra (imagen compartida por WhatsApp, enlace web, correo)? | Paquete de compartir en la app o página pública | V1: la app comparte la imagen del QR con el menú de compartir del teléfono | Abierta |
| D-19 | Un usuario que no es administrador, ¿puede crear otros usuarios? ¿Con qué roles? | Modelo de permisos (ADR 0004) | Solo quien tenga el permiso `seguridad.usuario.crear`; nunca puede dar un rol con más permisos que el suyo | Abierta |
| D-20 | ¿Hace falta un escáner de guardia en la app (puertas sin lector)? | Feature `escaner` y rol Guardia | Fuera de V1 | Abierta |
| D-21 | ¿Se anota algo de la persona que entra (nombre, motivo) al emitir el QR? | Datos personales y lo que muestra el historial | Solo una etiqueta libre opcional ("Proveedor de gas"); no se registra a la persona | Abierta |
| D-22 | ¿El login es código de cuenta + PIN, o solo el PIN? ¿De cuántos dígitos? | Seguridad contra adivinanza (ADR 0018) | Código de cuenta + PIN de 8 dígitos generado por el servidor | Abierta |
| D-23 | ¿Solo AGROCOM genera PIN, o también el administrador de la cuenta? | Permisos y relación con D-19 | Ambos; el administrador, dentro del límite del plan | Abierta |
| D-24 | ¿El administrador de la cuenta también entra con PIN, o con usuario y contraseña? | Un solo mecanismo de login o dos | Todos los usuarios de cuenta con PIN; usuario y contraseña solo para el super admin | Abierta |

## Cerradas

| # | Pregunta | Respuesta | Fecha y fuente |
|---|---|---|---|
| D-01 | ¿Lector en la puerta o QR fijo en la puerta? | **Lector QR en la puerta** (ESP32 + módulo lector). Un usuario de la cuenta genera el QR y se lo envía a quien va a entrar. El QR no es fijo: tiene vigencia de un día y se consume al usarse. Al final del día, usado o no, se da de baja (soft delete). Ver ADR 0008. | 2026-10-08, cliente |
| D-02 | ¿Abrir remoto desde la app? ¿Con qué tecnología se comunica la placa? | El cliente pide la comunicación más simple. **HTTPS sobre WiFi**: el ESP32 pregunta a la API en cada lectura. RS485 se descarta porque es un bus cableado y no hace falta. Firebase y MQTT también se descartan: agregan un servicio y solo sirven para que el servidor le hable a la placa (abrir remoto), que queda fuera de V1. Ver ADR 0009. | 2026-10-08, cliente |
| D-03 | ¿Qué placa y lector? | **ESP32** con un lector QR. El modelo exacto del lector se confirma al comprarlo (referencia: GM65 / GM861S por UART). | 2026-10-08, cliente |
| D-04 | ¿Qué tipo de cerradura? | **Se acciona con un pulso.** La duración del pulso es un parámetro de la puerta; el detalle eléctrico se define cuando exista la infraestructura. | 2026-10-08, cliente |
| D-05 | ¿Las puertas funcionan sin internet? | **No.** Sin red no se valida y no se abre (solo la salida física). Sin validación local en la placa. | 2026-10-08, cliente |
| D-07 | ¿Se guarda la foto de la persona? | No aplica: la persona que entra no se registra (ver D-21). | 2026-10-08, consecuencia de D-01 |
| D-09 | ¿Toda persona con acceso tiene usuario en la app? | No. La app la usan los usuarios de la cuenta (administran y emiten QR); quien entra solo recibe el QR y no queda registrado. | 2026-10-08, cliente |
| D-10 | ¿Antipassback? | No aplica: cada QR se consume en su primer uso. | 2026-10-08, consecuencia de D-01 |
| D-11 | ¿Invitaciones en V1? | Sí, y son el flujo principal: el QR emitido por un usuario **es** la invitación. | 2026-10-08, cliente |
