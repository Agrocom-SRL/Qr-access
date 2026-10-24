# ADR 0032 — Concurrencia, prioridad de las puertas y registro de lecturas

**Estado:** Propuesta (2026-10-23). Se acepta o descarta por partes con Miguel. El nombre del registro (§5) se decide al final de la planificación y se aplica en el último PR.

## Contexto

Surgen cuatro preguntas: cómo atiende la API muchas peticiones a la vez, si hace falta una cola con prioridades, si la placa trabaja de forma síncrona o asíncrona, y cómo no perder ninguna lectura sin llenar el registro de ruido cuando alguien insiste con un QR ya usado, vencido o anulado.

Lo que hay hoy (verificado en el código):
- Node atiende cada petición de forma **asíncrona**: ningún endpoint bloquea a los demás mientras espera a MySQL.
- El cuello de botella real es el **pool de MySQL: 10 conexiones** (`api/src/platform/db/pool.ts`), con cola de espera sin tope (el valor por omisión de `mysql2`) y sin tiempo máximo por consulta ni por petición.
- La validación hace varias consultas y una transacción (`validar-qr.ts`); el consumo del QR es atómico (`UPDATE … WHERE usado_at IS NULL`, una fila), así que dos lectores con el mismo QR nunca abren los dos.
- El firmware espera la respuesta como máximo 3 s (`cliente.cpp`) y, sin respuesta válida, **no abre**. Su máquina de estados no se bloquea, pero la decisión de abrir sí depende de la respuesta (falla segura).
- Cada `eventos_acceso` es solo inserción (invariante 4): hoy todo intento, repetido o no, es una fila.

## Decisión

### 1. Sin cola de mensajes para validar; prioridad por pools separados

Validar es una pregunta con respuesta inmediata: la persona espera frente a la puerta. Una cola (Redis, RabbitMQ) añade latencia y un punto de falla sin ventaja, así que **la validación sigue siendo petición-respuesta síncrona** desde la placa, y asíncrona dentro de Node. No se pierde ninguna lectura porque el consumo y el registro viajan en la misma transacción (ADR 0008).

La **prioridad** se logra separando recursos, no con una cola:
1. **Dos pools de MySQL:** uno reservado para `/dispositivos/*` (validaciones y latidos, por ejemplo 4 conexiones) y otro para la app y el panel (por ejemplo 6). Una avalancha de listados o de generación no deja a una puerta esperando. Los tamaños se ajustan con las pruebas de carga.
2. **Cola de espera acotada y fallo rápido:** `queueLimit` y un tiempo máximo para obtener conexión. Si se agota, la API responde `503` con `Retry-After` en vez de acumular peticiones; el firmware lo trata como «sin respuesta» y no abre.
3. **Tiempos coherentes de punta a punta:** consulta máxima (~1,5 s) < tiempo de petición de la API (~2,5 s) < espera del firmware (3 s). La API siempre contesta antes de que la placa se rinda.
4. **Rate limit de dispositivo** holgado y por credencial (ADR 0030 §3); nunca corta una apertura legítima.

Trabajos que **sí** van a un proceso asíncrono (no a la validación): envío de notificaciones, cierre del día, cálculo de estadísticas y detección de placas fuera de línea. Se implementan con una tabla de salida (*outbox*) escrita en la misma transacción que el hecho y un proceso que la consume; sin infraestructura nueva en V1.

### 2. Una sola instancia hoy; la base es el árbitro

Con una instancia, el consumo atómico ya garantiza un solo uso. Con varias instancias detrás de un balanceador también: lo decide MySQL, no la memoria del proceso. Lo que **no** escala sin cambios es el estado en memoria (limitador del login y del rate limit): sale a Redis o a la base antes de la segunda instancia (ADR 0030 §3). Ante un `ER_LOCK_DEADLOCK` o un timeout de bloqueo, la validación reintenta una vez; si vuelve a fallar, rechaza (falla segura).

### 3. No perder una lectura cuando se pierde la respuesta

Caso peligroso: la API consumió el QR y abrió, pero la respuesta no llegó a la placa (corte de red a los 3 s). La persona vuelve a pasar el QR y recibiría `qr.usado`: quedaría afuera con un QR bueno.

Decisión: **ventana de repetición** de 15 s. Si el mismo dispositivo lee el mismo token (por hash) dentro de la ventana de una lectura que ya fue `permitido`, la API responde de nuevo `abrir: true` **sin consumir otra vez** y enlaza el intento a la lectura original. Pasada la ventana, un QR usado se rechaza con `qr.usado`. Solo se repite una apertura al mismo lector, nunca a otra puerta ni a otra cuenta (el aislamiento por cuenta no cambia), y la ventana es corta para no ser una segunda oportunidad útil a quien fotografió el QR. Opcionalmente el firmware envía un `lectura_id` aleatorio por lectura para que la repetición sea exacta; sin él se usa el hash del token.

### 4. Ruido: el lector insiste con un QR ya usado, vencido o anulado

Los lectores de QR suelen releer el mismo código varias veces por segundo mientras está frente a ellos, y la gente insiste. Sin control, cada relectura es una fila rechazada.

1. **Firmware (antirrebote, no lógica de negocio):** tras una respuesta, ignora el mismo texto durante unos segundos y muestra el resultado. Reduce el ruido en el origen sin decidir nada.
2. **Servidor, registro sin ruido y sin romper la regla de solo inserción:** un rechazo idéntico (mismo dispositivo, mismo hash de token y mismo `motivo_code`) dentro de 60 s **sí se inserta**, pero marcado como `repetido_de_id` apuntando al primero. Los listados, las estadísticas y los tableros muestran por omisión solo el primero, con un «×N»; el detalle muestra todos. Ningún intento desaparece (invariante 4) y no se edita ninguna fila.
3. **Señales útiles, no ruido:** el conteo de repetidos y de `qr.usado` por QR alimenta las señales del ADR 0030 §4 (QR reenviado o compartido). Un rechazo distinto (otro motivo, otro lector) sí cuenta como intento nuevo.
4. **Relación con la confirmación de apertura (ADR 0031 §18):** la ventana de repetición no depende de ella; si la puerta no se abrió físicamente, se ve como `no_confirmada` en el panel y no se reabre sola.
5. **Retención:** las filas repetidas se pueden archivar antes que las demás cuando se defina la retención (duda D-06); eso es una excepción de borrado físico a justificar en su PR.

### 5. Nombre del registro (abierto; se hace al final)

«Evento de acceso» confunde: incluye lecturas rechazadas, el pulsador de salida y la puerta forzada. Opciones para decidir:
- **`intentos_acceso`** (recomendada): todo lo que se intentó, con resultado `permitido` o `rechazado`. «Intento» deja claro por qué hay filas fallidas.
- **`lecturas`**: describe bien al QR, no al pulsador ni a la llave.
- **`registro_accesos`**: neutro, pero «registro» ya nombra a la bitácora.

Renombrar toca la tabla, el repositorio, el contrato, los ARB y varios ADR. Como pasó con «emitir QR» → «generar QR», se hace **al final**, en una migración propia (`RENAME TABLE`) y un solo PR, con el resto estable. Mientras tanto todo usa `eventos_acceso`.

## Alternativas descartadas

- **Cola de prioridades con broker** para validar: más latencia y una pieza más que puede caerse; la separación de pools da la prioridad que se necesita.
- **Validación asíncrona** (la placa envía y consulta después): rompe la falla segura; la puerta no puede abrir «después».
- **Responder siempre `abrir: true` ante un reintento sin límite de tiempo:** convierte un QR de un solo uso en uno reutilizable.
- **Actualizar una fila con un contador de repeticiones:** contradice la regla de solo inserción.

## Consecuencias

- **API:** dos pools, `queueLimit`, tiempos máximos, respuesta `503` con `Retry-After`, reintento único ante deadlock, ventana de repetición en `validar-qr`, proceso de salida (*outbox*) y detección de placas fuera de línea (ADR 0031 §18).
- **Base:** `repetido_de_id` en el registro de intentos, índice `(tenant_id, dispositivo_id, token_hash, ocurrido_at)`; tabla de salida.
- **Firmware:** antirrebote del mismo texto y, opcional, `lectura_id`; sin lógica de negocio.
- **Panel y app:** listados con «×N» y detalle de repeticiones.
- **Tests obligatorios:** dos lectores con el mismo QR a la vez → solo uno abre; reintento dentro de 15 s → `abrir: true` sin segundo consumo y fuera de ventana → `qr.usado`; el reintento de otro dispositivo o de otra cuenta no abre; repetidos quedan enlazados y no se ocultan; pool de dispositivos disponible con el de la app saturado; con la cola llena la API responde `503` y la placa no abre.
- **Pruebas de carga (k6, entorno de prueba):** N puertas leyendo QR distintos y el mismo QR en paralelo, con tráfico de app saturando; se mide la latencia p95 de la validación, la espera por conexión y la cantidad de `503`.
