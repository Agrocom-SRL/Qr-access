# ADR 0025 — Solo Ethernet y vinculación remota de placas desde el panel

**Estado:** Aceptada (2026-10-13); el §2 (código por placa), el §5 (reclamo) y el §8 (alta manual) los reemplaza el ADR 0026 · Ajusta el ADR 0009 (comunicación y aprovisionamiento) y se apoya en el ADR 0004 §6 (credencial de dispositivo) y el ADR 0021 (panel web, solo super admin).

## Contexto

Hasta ahora la credencial del dispositivo (id, clave y URL de la API) se carga por el puerto serie, placa por placa. Con clientes reales no se puede ir con un programador a cada instalación, ni cada vez que una cuenta cancela y la placa se reutiliza en otra. Además se decidió que las placas (ESP32-ETH01) usarán **solo Ethernet**: el respaldo WiFi del commit #37 ya no hace falta.

El cliente no vincula nada: **AGROCOM vincula las placas desde el panel web**. La placa debe poder conectarse sin credencial, presentarse y recibir su vínculo sin intervención física.

## Decisión

1. **Solo Ethernet.** Se elimina WiFi del firmware (código, configuración y credenciales de red). El portal AP del ADR 0009 queda descartado. Sin cable no hay red, y sin red no se abre (invariante 2).
2. **Una placa es un inventario de la plataforma** (`placas`, sin `tenant_id`): su **MAC** de fábrica (la del ESP32) y un **código de vinculación** aleatorio de 16 caracteres (Crockford base32, 80 bits) que **sortea el servidor** al registrar la placa en el panel: se muestra una sola vez, el taller lo carga en la NVS de la placa (`set codigo …` por serie) y en la base queda hasheado con argon2id en `placas.codigo_hash`. La MAC sola no sirve de prueba porque es pública y falsificable; el código es el secreto.
3. **Un dispositivo es la asignación de una placa a una puerta** (`dispositivos.placa_id`). Reasignar una placa **crea otro dispositivo** y revoca el anterior, de modo que el historial de cada cuenta (eventos, QR usados) sigue apuntando a su propio dispositivo.
4. **La clave la genera la placa, no el servidor.** En su primer arranque sin credencial, la placa sortea una clave de 32 bytes con `esp_random()` y la guarda en su NVS. Así el servidor nunca guarda ni transmite una clave en claro, y no hay un estado intermedio "asignado, esperando entrega".
5. **Protocolo de reclamo** (`POST /api/v1/dispositivos/reclamar`, sin autenticación de dispositivo; cuerpo `{ mac, codigo, clave, firmware_version }`), cada 30 s mientras la placa no tenga vínculo:
   - MAC o código inválidos → `401` (`dispositivo.reclamo_invalido`) con el mismo cuerpo siempre (no revela si la MAC existe), con límite de intentos por IP y por MAC: tras 10 fallos, `429` (`dispositivo.reclamo_bloqueado`) con bloqueo creciente. El código se acepta tal como lo teclea una persona (sin espacios ni guiones, sin distinguir mayúsculas).
   - Código válido y la placa **sin dispositivo en servicio** → el servidor guarda `argon2id(clave)` en `placas.clave_hash`, actualiza `ultimo_reclamo_at`, `ultima_ip` y `firmware_version`, y responde `200 { estado: "pendiente" }`.
   - Código válido y la placa **con dispositivo en servicio** y `clave` coincide con `placas.clave_hash` → `200 { estado: "vinculado", dispositivo_id }`. Es idempotente: si la respuesta se pierde, el siguiente sondeo la repite.
   - Código válido pero `clave` distinta con dispositivo en servicio → `401` (otra placa o una copia).
6. **Vincular desde el panel** (`POST /plataforma/placas/:id/vincular`, permiso `dispositivos.placa.vincular`): AGROCOM elige cuenta, sitio, puerta y nombre; el servidor crea el `dispositivo` con `clave_hash` copiado de `placas.clave_hash`. Exige que la placa ya haya hecho un reclamo (tiene `clave_hash`), que no tenga otro dispositivo en servicio y que el plan de la cuenta permita otro dispositivo. Desde ese momento la placa, en su siguiente sondeo, pasa a autenticarse como hoy: `Authorization: Dispositivo <id>.<clave>` (ADR 0004 §6).
7. **Liberar** (`POST /plataforma/placas/:id/liberar`, permiso `dispositivos.placa.liberar`): revoca el dispositivo (`revocado_at`), borra `placas.clave_hash` y deja la placa lista para otra cuenta. La placa recibe `401` en su siguiente llamada autenticada, **borra id y clave de su NVS (conserva MAC y código)**, sortea una clave nueva y vuelve a reclamar. Sin red hasta entonces, no abre nada (falla segura).
8. **Alta de placas**: `POST /plataforma/placas` con la MAC (la placa la imprime por serie al arrancar); la respuesta trae el código **una sola vez**. `DELETE /plataforma/placas/:id` la da de baja (soft delete) si se pierde o se destruye; una placa vinculada se libera antes. El alta en lote queda para cuando haga falta.
9. **Inventario y estado en el panel** (solo super admin): MAC, estado derivado (`de_fabrica` si no tiene dispositivo en servicio; `vinculada` si lo tiene), cuenta y puerta actuales, versión de firmware, IP, último contacto (último latido si está vinculada, último reclamo si no) y en línea o fuera de línea. La app muestra a cada cuenta solo el estado en línea de sus puertas, de solo lectura.
10. **Permisos nuevos**, de ámbito plataforma (ADR 0004): `dispositivos.placa.ver`, `.registrar` (alta y baja), `.vincular` y `.liberar`. Las rutas viven bajo `/plataforma/` y quedan en la bitácora (alta, vinculación, liberación; nunca claves ni códigos).

## Alternativas descartadas

- **Que el servidor genere la clave y la entregue a la placa**: obliga a guardar la clave en claro hasta que la placa la recoja, o a un estado intermedio con una entrega única que se puede perder.
- **Código de vinculación derivado de la MAC con un secreto compartido en el firmware**: un binario extraído destapa todas las placas (invariante 6).
- **Vincular por la MAC sola**: cualquiera que conozca la MAC de una placa sin vincular podría presentarse como ella y recibir el vínculo.
- **Estado `asignado` en `dispositivos`** (columnas nulas hasta que llegue la clave): relaja los `NOT NULL` de una tabla con datos de cuenta y mezcla filas sin cuenta con filas de cuenta. Mantener `placas` aparte deja el aislamiento por cuenta intacto.
- **Que el cliente vincule con QR desde la app**: innecesario; AGROCOM controla el inventario y evita errores de asignación.
- **WiFi como respaldo**: mayor superficie de ataque, credenciales de red por placa y más estados; se decidió Ethernet.

## Consecuencias

- **Migraciones** `20261013100001_create_placas.sql` y `20261013100002_add_placa_id_a_dispositivos.sql`. `dispositivos.placa_id` es nulo solo para los dispositivos de desarrollo anteriores; los nuevos siempre lo llevan.
- **Aislamiento (invariante 1):** `placas` no tiene `tenant_id` y solo la tocan repositorios de plataforma; el repositorio base de cuenta nunca la ve. `reclamar` es un endpoint sin contexto de cuenta y salta el aislamiento por diseño: revisión línea por línea, como la autenticación de dispositivos.
- **Invariante 5:** cada dispositivo sigue con su propia credencial hasheada, revocable, de una sola cuenta y una sola puerta. Una placa puede pasar por varias cuentas, nunca por dos a la vez (`uq_dispositivos_placa`).
- **Historial:** los eventos conservan su `tenant_id` y `puerta_id`; una cuenta nunca ve el dispositivo ni la placa de otra, aunque la placa se haya reasignado.
- `ultimo_rssi` de `dispositivos` queda sin uso al eliminar WiFi; se retira en una migración posterior cuando el latido deje de enviarlo.
- **Hardware:** el taller necesita un paso de alta por placa (flashear, generar código, registrar en el panel). El flasheo se hace una sola vez; el firmware de producción se actualiza luego por OTA (ADR 0009).
- **Tests prioritarios:** reclamo con código incorrecto (siempre el mismo `401` y con límite de intentos), idempotencia, clave distinta con dispositivo en servicio, vincular sin reclamo previo, plan sin cupo, liberar y que el dispositivo anterior ya no autentique, reasignar y que la cuenta anterior no vea nada de la nueva, y que ni la clave ni el código lleguen a la bitácora ni a un log.
- **Hecho:** API de placas (`/plataforma/placas`, `/dispositivos/reclamar`). **Pendiente** (en este orden): firmware (quitar WiFi, estado sin vincular, reclamo, borrado de NVS ante `401`), panel web (inventario y vinculación) y estado en línea en la app.
