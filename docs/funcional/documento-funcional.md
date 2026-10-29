# Documento funcional V1 — AGROCOM Acceso

**Estado:** Borrador validado en lo principal con el cliente (2026-10-08). Todo lo marcado **[confirmar]** sigue abierto en `docs/modelo-datos/02-dudas-y-ambiguedades.md`.

## 1. Objetivo

AGROCOM vende a empresas (cuentas) una suscripción para controlar sus puertas eléctricas con QR. Los usuarios de cada cuenta generan QR de un solo uso y se los envían a quien tiene que entrar. En la puerta, un lector conectado a un ESP32 lee el QR y abre solo si la API lo valida. Cada intento queda registrado, y ninguna cuenta ve los datos de otra.

## 2. Actores

| Actor | Qué hace |
|---|---|
| Super admin (AGROCOM) | Da de alta cuentas, su plan, su suscripción y sus PIN de acceso; soporte; ve el uso de cada cuenta |
| Administrador de cuenta | Usuarios y roles de su cuenta, sitios, puertas, dispositivos; genera y anula QR; ve todas las lecturas de su cuenta |
| Usuario de cuenta | Genera QR y los comparte; ve sus QR y las lecturas de esos QR; si tiene el permiso, crea otros usuarios [confirmar D-19] |
| Persona que entra | Recibe un QR (por WhatsApp, correo…) y lo muestra al lector. **No tiene app ni queda registrada** |
| Dispositivo | Lee el QR, pregunta a la API y da el pulso a la cerradura |

## 3. Alcance V1

- §4.1 Cuentas, planes y suscripciones.
- §4.2 Acceso a la plataforma: login por PIN y rol único por usuario.
- §4.3 Sitios y puertas.
- §4.4 Dispositivos: alta, credencial, latido y configuración.
- §4.5 Generación, envío y anulación de QR.
- §4.6 Validación en la puerta.
- §4.7 Lecturas (intentos de lectura de un QR) y bitácora.
- Fuera de V1: abrir remoto desde la app, operación sin red (D-05: no), escáner de guardia (D-20), pasarela de pago (D-15), reportes exportables.

## 4. Funcionalidades

### 4.1 Cuentas, planes y suscripciones (ADR 0017)
- HU-01: Como super admin, doy de alta una cuenta con su código único de 3 letras, su plan, su suscripción (desde/hasta) y su primer administrador.
- HU-02: Como super admin, renuevo, cambio de plan o suspendo la suscripción de una cuenta.
- HU-03: Como administrador de cuenta, veo mi plan, su vencimiento y cuánto uso de cada límite (dispositivos, usuarios).

### 4.2 Acceso a la plataforma (ADR 0004)
- HU-04: Como usuario, ingreso con el PIN que me entregaron (p. ej. `AGR7K2Q`: código de mi cuenta + 4 caracteres), en la app móvil o en la web (ADR 0018) [confirmar D-24].
- HU-05: ~~Como usuario con más de un rol, elijo el rol activo y lo cambio sin volver a ingresar.~~ **Reemplazada por el ADR 0028:** cada usuario tiene un solo rol y no hay cambio de rol; quien necesite dos funciones tiene dos usuarios.
- HU-06: Como super admin, o como administrador de la cuenta con el permiso `seguridad.usuario.crear`, genero PIN de acceso para la cuenta (cada PIN es un usuario con su etiqueta y sus roles), dentro del límite del plan; lo veo una sola vez, y lo regenero o lo doy de baja.

### 4.3 Sitios y puertas
- HU-07: Como administrador, registro sitios (nombre, dirección, zona horaria) y sus puertas (nombre, duración del pulso de apertura).

### 4.4 Dispositivos (ADR 0009)
- HU-08: Como administrador, doy de alta un dispositivo para una puerta, dentro del límite del plan, y obtengo su credencial (se muestra una sola vez).
- HU-09: Como administrador o guardia (permiso `organizacion.puerta.supervisar`), veo qué dispositivos están en línea y cuáles no reportan latido (sin latido en 3 minutos = sin conexión).
- HU-10: Como administrador, revoco un dispositivo.

- HU-18: Como administrador de la cuenta, habilito o deshabilito la apertura manual por puerta (ADR 0035).
- HU-19: Como usuario de cualquier rol, desde la app móvil o web abro una puerta habilitada de mi cuenta, entrando o saliendo, sin QR; veo si la placa la abrió o falló.
- HU-20: Como administrador, registro hasta dos placas por puerta, una de entrada y otra de salida (o una sola para ambos sentidos).
- HU-21: Como super admin, veo en el panel el uso de la apertura manual: total, por puerta y por cuenta, frecuencia, cuentas con el modo activo y fallos.

### 4.5 Generación de QR (ADR 0008)
- HU-11: Como usuario, genero un QR para una o más puertas de mi cuenta [confirmar D-17], con una etiqueta opcional [confirmar D-21]. Vence por defecto al final del día [confirmar D-16], sin pasar la vigencia máxima del plan.
- HU-12: Como usuario, comparto la imagen del QR desde la app (WhatsApp, correo…) [confirmar D-18].
- HU-13: Como usuario, veo los QR que generé y su estado (vigente, usado, vencido, anulado), y anulo uno vigente.
- Los QR parecen ilimitados para el cliente, pero la generación se controla internamente con topes por usuario y una bolsa por plan (ADR 0030); validar un QR en la puerta nunca se limita. Al final del día, los vencidos se dan de baja (soft delete), usados o no.

### 4.6 Validación en la puerta
- HU-14: Como dispositivo, envío el QR leído y doy el pulso solo si la API responde `abrir: true`.
- Un QR se consume en su primer uso válido: la segunda lectura se rechaza.

### 4.7 Lecturas
Cada intento de lectura de un QR, aceptado o rechazado, queda como una lectura (tabla `lecturas`; antes «eventos de acceso», ADR 0032 §5).
- HU-15: Como administrador, consulto las lecturas (intentos permitidos y rechazados) con filtros por puerta, usuario generador, resultado y fecha.
- HU-16: Como usuario, veo las lecturas de los QR que generé.
- HU-17: Como super admin, veo el uso de QR y de dispositivos por cuenta.
- Las aperturas manuales también son lecturas (`metodo = manual`), con el usuario y el sentido (ADR 0035 §6).

## 5. Reglas funcionales

| Código | Regla |
|---|---|
| RF-01 | Ninguna cuenta ve ni opera datos de otra. |
| RF-02 | La puerta solo abre con una orden positiva de la API, ya sea la validación de un QR o una apertura manual autorizada (falla segura); sin red o sin orden no abre. |
| RF-03 | Un QR vale una sola vez y vence (ADR 0008). |
| RF-04 | Todo intento de acceso se registra con su resultado y motivo, y el registro no se modifica. |
| RF-05 | El vencimiento "fin del día" se calcula en la zona horaria del sitio. |
| RF-06 | Un QR anulado, un usuario desactivado o una suscripción vencida no abren ninguna puerta desde ese momento. |
| RF-07 | Un dispositivo solo valida QR de su cuenta y de su puerta. |
| RF-08 | La apertura física por pulsador de salida no depende de la red. |
| RF-09 | Toda modificación relevante queda en la bitácora con autor, fecha, valores antes/después y origen. |
| RF-10 | Los límites del plan los hace cumplir la API (ADR 0017). |
| RF-11 | La apertura manual solo existe en las puertas que el administrador de la cuenta habilitó; la API valida al usuario como valida un QR y la orden vence en segundos y se entrega una sola vez (ADR 0035). |
| RF-12 | Toda petición de apertura manual, aceptada o rechazada, queda como lectura con su usuario, sentido y motivo, y el resultado de la placa queda en la confirmación de apertura. |

## 6. Criterios de aceptación transversales

- Respuesta de validación de la API < 500 ms (p95); el firmware espera hasta 3 s.
- La app funciona en Android 8+, iOS 15+ y los navegadores actuales (Chrome, Safari, Firefox, Edge).
