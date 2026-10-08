# Documento funcional V0 — AGROCOM Acceso

**Estado:** Borrador para validar con el cliente (2026-10-08). Todo lo marcado **[confirmar]** está abierto en `docs/modelo-datos/02-dudas-y-ambiguedades.md`.

## 1. Objetivo

Controlar la apertura de puertas eléctricas con QR: cada persona autorizada abre con un QR personal y dinámico desde la app, cada intento queda registrado y cada empresa (cuenta) administra sus propios sitios, puertas, personas y reglas sin ver los de otra.

## 2. Actores

| Actor | Qué hace |
|---|---|
| Super admin (AGROCOM) | Da de alta cuentas y su primer administrador; soporte |
| Administrador de cuenta | Sitios, puertas, dispositivos, personas, grupos, reglas, usuarios y roles; ve eventos |
| Guardia | Escanea QR con la app en puertas sin lector; ve eventos de sus puertas |
| Usuario (persona con acceso) | Muestra su QR dinámico; ve su historial |
| Visitante | Recibe una invitación (enlace) con un QR de un solo uso, sin instalar la app |
| Dispositivo | Lee QR, consulta a la API y acciona la cerradura |

## 3. Alcance V1

- §4.1 Acceso a la plataforma: login por cuenta + usuario, roles, rol activo.
- §4.2 Organización: sitios y puertas.
- §4.3 Personas y grupos.
- §4.4 Reglas de acceso (quién, qué puerta, qué días y horas).
- §4.5 Credencial QR dinámica y validación en la puerta.
- §4.6 Dispositivos: alta, credencial, latido, configuración.
- §4.7 Eventos de acceso y bitácora.
- §4.8 Invitaciones de visitantes **[confirmar]**.
- Fuera de V1 salvo confirmación: abrir remoto desde la app, operación sin red, antipassback, integración con RR. HH., reportes exportables.

## 4. Funcionalidades

### 4.1 Acceso a la plataforma
- HU-01: Como usuario, ingreso con código de cuenta, usuario y contraseña.
- HU-02: Como usuario con más de un rol, elijo el rol activo y lo cambio sin volver a ingresar.
- HU-03: Como administrador, creo usuarios de mi cuenta y les asigno roles.

### 4.2 Sitios y puertas
- HU-04: Como administrador, registro sitios (nombre, dirección, zona horaria) y sus puertas (nombre, tipo de cerradura, segundos de apertura).

### 4.3 Personas y grupos
- HU-05: Como administrador, registro personas (nombre, documento, foto **[confirmar]**) y las agrupo (p. ej. "Administración", "Turno noche").
- Una persona puede tener o no usuario de la app **[confirmar]**: si no tiene app, solo puede entrar por invitación o escáner de guardia.

### 4.4 Reglas de acceso
- HU-06: Como administrador, defino que una persona o grupo puede abrir una puerta en ciertos días y franjas horarias, con vigencia desde/hasta.
- La hora se evalúa en la zona horaria del sitio.

### 4.5 QR dinámico y validación
- HU-07: Como usuario, abro "Mi QR" y lo muestro al lector; el QR cambia cada 30 s y funciona sin datos móviles.
- HU-08: Como dispositivo, envío el QR leído y abro solo si la API lo permite.
- HU-09: Como guardia, escaneo un QR con la app para una puerta elegida.

### 4.6 Dispositivos
- HU-10: Como administrador, doy de alta un dispositivo para una puerta y obtengo su credencial (una sola vez).
- HU-11: Como administrador, veo qué dispositivos no reportan latido.
- HU-12: Como administrador, revoco un dispositivo.

### 4.7 Eventos
- HU-13: Como administrador o guardia, consulto los intentos de acceso (permitidos y rechazados) con filtros por puerta, persona, resultado y fecha.
- HU-14: Como usuario, veo mi propio historial.

### 4.8 Invitaciones [confirmar]
- HU-15: Como usuario con permiso, invito a un visitante a una puerta en una ventana de tiempo; el visitante recibe un enlace con un QR de un solo uso.

## 5. Reglas funcionales

| Código | Regla |
|---|---|
| RF-01 | Ninguna cuenta ve ni opera datos de otra. |
| RF-02 | La puerta solo abre con una validación positiva de la API (falla segura). |
| RF-03 | Un QR vale una sola vez y vence (ADR 0008). |
| RF-04 | Todo intento de acceso se registra con su resultado y motivo, y el registro no se modifica. |
| RF-05 | Una regla de acceso se evalúa en la zona horaria del sitio, dentro de su vigencia y de sus franjas. |
| RF-06 | Una persona o credencial desactivada no abre ninguna puerta desde ese momento. |
| RF-07 | Un dispositivo solo valida para su puerta y su cuenta. |
| RF-08 | La apertura física por pulsador de salida no depende de la red. |
| RF-09 | Toda modificación relevante queda en la bitácora con autor, fecha, valores antes/después y origen. |

## 6. Criterios de aceptación transversales

- Respuesta de validación de la API < 500 ms (p95) en la red local del sitio; el firmware espera hasta 3 s.
- La app funciona en Android 8+, iOS 15+ y los navegadores actuales (Chrome, Safari, Firefox, Edge).
