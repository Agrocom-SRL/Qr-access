# ADR 0032 — Concurrencia, prioridad de las puertas y registro de lecturas

**Estado:** Propuesta (2026-10-23). Se acepta o descarta por partes con Miguel. El nombre del registro (§5) quedó decidido por Miguel (`lecturas`, 2026-10-26/27) y se aplicó en la ola W14.

## Contexto

Surgen cuatro preguntas: cómo atiende la API muchas peticiones a la vez, si hace falta una cola con prioridades, si la placa trabaja de forma síncrona o asíncrona, y cómo no perder ninguna lectura sin llenar el registro de ruido cuando alguien insiste con un QR ya usado, vencido o anulado.

Lo que hay hoy (verificado en el código):
- Node atiende cada petición de forma **asíncrona**: ningún endpoint bloquea a los demás mientras espera a MySQL.
- El cuello de botella real es el **pool de MySQL: 10 conexiones** (`api/src/platform/db/pool.ts`), con cola de espera sin tope (el valor por omisión de `mysql2`) y sin tiempo máximo por consulta ni por petición.
- La validación hace varias consultas y una transacción (`validar-qr.ts`); el consumo del QR es atómico (`UPDATE … WHERE usado_at IS NULL`, una fila), así que dos lectores con el mismo QR nunca abren los dos.
- El firmware espera la respuesta como máximo 3 s (`cliente.cpp`) y, sin respuesta válida, **no abre**. Su máquina de estados no se bloquea, pero la decisión de abrir sí depende de la respuesta (falla segura).
- Cada fila de `lecturas` es solo inserción (invariante 4): hoy todo intento, repetido o no, es una fila.

## Decisión

### 1. Sin cola de mensajes para validar; prioridad por pools separados

Validar es una pregunta con respuesta inmediata: la persona espera frente a la puerta. Una cola (Redis, RabbitMQ) añade latencia y un punto de falla sin ventaja, así que **la validación sigue siendo petición-respuesta síncrona** desde la placa, y asíncrona dentro de Node. No se pierde ninguna lectura porque el consumo y el registro viajan en la misma transacción (ADR 0008).

La **prioridad** se logra separando recursos, no con una cola:
1. **Dos pools de MySQL:** uno reservado para `/dispositivos/*` (validaciones y latidos, por ejemplo 4 conexiones) y otro para la app y el panel (por ejemplo 6). Una avalancha de listados o de generación no deja a una puerta esperando. Los tamaños se ajustan con las pruebas de carga.
2. **Cola de espera acotada y fallo rápido:** `queueLimit` y un tiempo máximo para obtener conexión. Si se agota, la API responde `503` con `Retry-After` en vez de acumular peticiones; el firmware lo trata como «sin respuesta» y no abre.
3. **Tiempos coherentes de punta a punta:** consulta máxima (~1,5 s) < tiempo de petición de la API (~2,5 s) < espera del firmware (3 s). La API siempre contesta antes de que la placa se rinda.
4. **Rate limit de dispositivo** holgado y por credencial (ADR 0030 §3); nunca corta una apertura legítima.

Trabajos que **sí** van a un proceso asíncrono (no a la validación): envío de notificaciones, cierre del día, cálculo de estadísticas y detección de placas fuera de línea. Se implementan con una tabla de salida (*outbox*) escrita en la misma transacción que el hecho y un proceso que la consume; sin infraestructura nueva en V1.

**Implementado (ola W3, API):** dos pools (`api/src/platform/db/pools.ts`): `dispositivos` (4 conexiones por defecto) para las rutas del dispositivo autenticado (validaciones, latidos, configuración y la autenticación de su credencial) y `app` (6) para todo lo demás, incluidos `anunciar` y `confirmar`, que no llevan credencial. `queueLimit` (20 y 50) y espera máxima por conexión (500 ms y 3 s) vía un envoltorio de `getConnection`/`query`/`execute`, porque `mysql2` no trae tiempo de espera. Consulta máxima con `max_statement_time` de MariaDB (1,5 s dispositivos, 5 s app). Petición máxima con `handlerTimeout` de Fastify (2,5 s en las rutas del dispositivo, 15 s en el resto). La configuración exige consulta < petición < 3 s del firmware y no arranca si no se cumple. Pool lleno, espera agotada, consulta o petición excedidas y deadlock que sobrevive al reintento salen como `503` `servicio.no_disponible` con `Retry-After` (`REINTENTO_503_SEGUNDOS`, 2 s). Todos los tamaños y tiempos son variables `DB_*` y `PETICION_*`.

**Hallazgo y corrección (pruebas de carga con k6):** la primera versión pasaba `request.signal` de Fastify a las transacciones de `validar-qr` como presupuesto. Con cualquier cliente HTTP real que enviara cuerpo (curl, k6, la placa) la validación respondía `503` en ~50 ms, porque Fastify aborta esa señal con el evento `close` del `IncomingMessage` y Node 22 lo emite apenas termina de leer el cuerpo de un POST: la señal llegaba ya abortada al handler. Fallaba seguro (la puerta no abría), pero la validación no funcionaba en producción; `app.inject()` no abre un socket y no lo veía. Corrección: `api/src/platform/http/presupuesto.ts` (`presupuestoDePeticion`) construye un `AbortSignal` propio que se aborta solo por (1) un plazo propio, `PETICION_MS_DISPOSITIVOS` contado desde que llegó la petición, y (2) una desconexión real del cliente, detectada con el `close` de la RESPUESTA sin haber terminado de escribirse (no se confunde con el fin de lectura del cuerpo). La semántica no cambia: con el presupuesto vencido no se empieza la transacción, no se reintenta tras un deadlock y no se hace COMMIT (ROLLBACK, `PresupuestoAgotado`, `503`). Ninguna otra acción usaba `request.signal`; `handlerTimeout` se mantiene como tope de la respuesta. **Lección:** las pruebas de la API deben incluir tests con servidor real (`app.listen({ port: 0 })` y `fetch`/`http`), además de `inject()`: `test/platform/servidor-real.test.ts` cubre validaciones (abre, segundo uso, plazo vencido sin consumir, cliente lento, desconexión), `POST /sesiones` y `POST /qr-accesos`. Está prohibido usar `request.signal` como presupuesto.

### 2. Una sola instancia hoy; la base es el árbitro

Con una instancia, el consumo atómico ya garantiza un solo uso. Con varias instancias detrás de un balanceador también: lo decide MySQL, no la memoria del proceso. Lo que **no** escala sin cambios es el estado en memoria (limitador del login y del rate limit): sale a Redis o a la base antes de la segunda instancia (ADR 0030 §3). Ante un `ER_LOCK_DEADLOCK` o un timeout de bloqueo, la validación reintenta una vez (`enTransaccionIdempotente`, solo para transacciones idempotentes: el consumo del QR y su evento se deshacen juntos); si vuelve a fallar, no abre: la API responde `503` y la placa lo trata como sin respuesta.

**Presupuesto de la petición y consumo (ola W3, auditoría).** La validación recibe la señal de la petición (`request.signal`, que Fastify aborta al vencer el `handlerTimeout` o cortarse la conexión) y la pasa a `enTransaccionIdempotente`: con la señal vencida no se empieza la transacción, no se reintenta tras un deadlock y, sobre todo, **no se hace COMMIT** antes de confirmar el consumo (ROLLBACK, `PresupuestoAgotado`): la placa ya no espera, la puerta no abre y el QR queda sin consumir. La configuración exige además que el presupuesto de UN intento quepa en la petición: espera por conexión + consulta máxima < petición < 3 s del firmware (en el pool del dispositivo y en el de la app); con reintento no cabe, y por eso la señal es lo que lo corta. **Riesgo residual:** el COMMIT que se confirma justo antes del vencimiento, cuya respuesta ya no llega a la placa: el QR queda consumido y la puerta cerrada. Lo cubre la ventana de repetición de 15 s (§3, ola W7), que vuelve a responder `abrir: true` al mismo lector sin consumir otra vez. No se reabre el mismo QR por otra vía (invariante 3).

**Excepción conocida a la invariante 4.** Cuando la base de datos no responde (pool saturado, consulta o petición vencidas, deadlock persistente) o el rate limit corta la validación (429), el intento **no puede** quedar en `lecturas`: no hay dónde escribirlo. La puerta no abre (falla segura) y el rastro es el log: cada 429 o 503 de una ruta del dispositivo registra un `warn` con `dispositivoId`, `puertaId` y, en el 429, la clase del límite (sin credenciales ni texto de QR). El rechazo por 429 de validación *sí* se podría registrar (la base responde), pero requiere un `motivo_code` `limite_excedido` que hoy no existe en el catálogo de motivos: **pendiente** para una ola con cambio de esquema y de contrato (no se inventa el motivo acá).

### 3. No perder una lectura cuando se pierde la respuesta

Caso peligroso: la API consumió el QR y abrió, pero la respuesta no llegó a la placa (corte de red a los 3 s). La persona vuelve a pasar el QR y recibiría `qr.usado`: quedaría afuera con un QR bueno.

Decisión: **ventana de repetición** de 15 s. Si el mismo dispositivo lee el mismo token (por hash) dentro de la ventana de una lectura que ya fue `permitido`, la API responde de nuevo `abrir: true` **sin consumir otra vez** y enlaza el intento a la lectura original. Pasada la ventana, un QR usado se rechaza con `qr.usado`. Solo se repite una apertura al mismo lector, nunca a otra puerta ni a otra cuenta (el aislamiento por cuenta no cambia), y la ventana es corta para no ser una segunda oportunidad útil a quien fotografió el QR. Opcionalmente el firmware envía un `lectura_id` aleatorio por lectura para que la repetición sea exacta; sin él se usa el hash del token.

**Una sola repetición por lectura original (auditoría de W7, decisión de Miguel).** La ventana cubre UNA respuesta perdida, no un lector que insiste: por cada apertura original la API permite **una** repetición `permitido` (las filas permitidas con `repetido_de_id = original.id`); la segunda relectura recibe `qr.usado` y queda como rechazo. La cuenta se hace con la fila del original bloqueada (`SELECT … FOR UPDATE`) dentro de la transacción de la repetición, así que seis relecturas simultáneas producen un consumo, como máximo una repetición que abre y el resto `qr.usado`. **Supuesto:** el firmware ya no reenvía la misma lectura que abrió. Tras una respuesta válida con `abrir: true` ignora el mismo texto durante los 15 s de la ventana (constante `IGNORAR_MISMO_QR_TRAS_ABRIR_MS`) o hasta leer un texto distinto; tras un fallo, timeout o respuesta inválida solo rige el antirrebote corto de 1 s. Así la repetición del servidor solo se usa cuando la respuesta se perdió (el firmware no vio un `abrir: true`) y el reintento legítimo es siempre el primero. La falla segura no cambia: la puerta abre solo con una respuesta positiva. Las repeticiones permitidas no son invisibles: el resumen, el listado y el panel de plataforma las cuentan aparte (`repeticiones_permitidas`) sin sumarlas a los permitidos.

### 4. Ruido: el lector insiste con un QR ya usado, vencido o anulado

Los lectores de QR suelen releer el mismo código varias veces por segundo mientras está frente a ellos, y la gente insiste. Sin control, cada relectura es una fila rechazada.

1. **Firmware (antirrebote, no lógica de negocio):** tras una respuesta, ignora el mismo texto durante unos segundos y muestra el resultado. Reduce el ruido en el origen sin decidir nada.
2. **Servidor, registro sin ruido y sin romper la regla de solo inserción:** un rechazo idéntico (mismo dispositivo, mismo hash de token y mismo `motivo_code`) dentro de 60 s **sí se inserta**, pero marcado como `repetido_de_id` apuntando al primero. Los listados, las estadísticas y los tableros muestran por omisión solo el primero, con un «×N»; el detalle muestra todos. Ningún intento desaparece (invariante 4) y no se edita ninguna fila.
3. **Señales útiles, no ruido:** el conteo de repetidos y de `qr.usado` por QR alimenta las señales del ADR 0030 §4 (QR reenviado o compartido). Un rechazo distinto (otro motivo, otro lector) sí cuenta como intento nuevo.
4. **Relación con la confirmación de apertura (ADR 0031 §18):** la ventana de repetición no depende de ella; si la puerta no se abrió físicamente, se ve como `no_confirmada` en el panel y no se reabre sola.
5. **Retención:** las filas repetidas se pueden archivar antes que las demás cuando se defina la retención (duda D-06); eso es una excepción de borrado físico a justificar en su PR.

### 5. Nombre del registro — Decidido: `lecturas` (Miguel, 2026-10-26/27)

«Evento de acceso» confundía: incluye lecturas rechazadas, el pulsador de salida y la puerta forzada. Se evaluaron `intentos_acceso`, `lecturas` y `registro_accesos`. **Decisión de Miguel: «se entiende mejor como lecturas».** La tabla pasa a llamarse **`lecturas`**: cada fila es un intento de lectura de un QR, aceptado o rechazado. «Intento de lectura» queda como concepto en los textos cuando se habla del intento (por ejemplo, «este intento de lectura se rechazó»); «lectura» es el nombre de la fila y del recurso.

Lo implementado (ola W14, como pasó con «emitir QR» → «generar QR»: un solo PR, con el resto estable):
- **Base:** migración `20261103100001_rename_eventos_acceso_a_lecturas.sql`: `RENAME TABLE` (atómico), índices renombrados con `RENAME INDEX` y claves foráneas rehechas en el mismo `ALTER`, todo `INPLACE, LOCK=NONE` para no bloquear la escritura de las placas. Las claves foráneas de las tablas hijas (`confirmaciones_apertura`) y la autorreferencia `repetido_de_id` siguen al nombre nuevo. Los dos `CHECK` conservan su nombre antiguo (`ck_eventos_acceso_*`): renombrarlos exige copiar la tabla. El `down` revierte todo.
- **API:** el repositorio es `RepositorioDeLecturas` y las acciones `listar-lecturas`, `ver-lectura` y `resumir-lecturas`. Rutas nuevas `GET /lecturas`, `/lecturas/resumen`, `/lecturas/{id}` y `/plataforma/lecturas`, con el mismo handler, esquema y permiso (`accesos.evento.ver`, `resumen.panel.ver`) que las anteriores.
- **Compatibilidad (ADR 0005, ningún cambio incompatible dentro de `/api/v1`):** `/eventos-acceso` (con `/resumen` y `/{id}`) y `/plataforma/eventos-acceso` siguen respondiendo igual y están marcadas `deprecated` en el OpenAPI. **Fecha de retiro propuesta (supuesto, por confirmar con Miguel): 2027-06-30**, con aviso previo en el changelog y una vez que la app y el panel publicados ya no las llamen. Se mantienen sin cambio los campos JSON existentes (`evento_id`, `evento_acceso_ids`, `evento_acceso_id`), los códigos de error (`evento.no_encontrado`) y los permisos (`accesos.evento.*`): renombrarlos es un cambio incompatible y queda para una `v2`.
- **Bitácora:** `lecturas` es de solo inserción y no pasa por la bitácora; los valores históricos de `bitacoras.tabla` no se reescriben.
- **App y panel:** los textos dicen «Lecturas» (ES), «Leituras» (PT) y «Scans» (EN) y llaman a `/lecturas` y `/plataforma/lecturas`.
- **Despliegue:** entre el `RENAME TABLE` (decenas de milisegundos) y el arranque del código nuevo, el código anterior falla al escribir en `eventos_acceso`; por la falla segura la puerta no abre, y la placa reintenta. Se despliega con la API detenida un instante: migrar y arrancar la versión nueva seguidos (`docs/gestion/despliegue.md`).

*Nombre anterior (compatibilidad):* `eventos_acceso`. Aparece solo en las migraciones históricas, en la migración del renombre, en la nota de la ficha `docs/modelo-datos/tablas/16_lecturas.md`, en esta nota y en los alias obsoletos `/eventos-acceso`.

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
- **Tests obligatorios:** dos lectores con el mismo QR a la vez → solo uno abre; reintento dentro de 15 s → `abrir: true` sin segundo consumo, la segunda relectura → `qr.usado`, y fuera de ventana → `qr.usado`; el reintento de otro dispositivo o de otra cuenta no abre; repetidos quedan enlazados y no se ocultan; pool de dispositivos disponible con el de la app saturado; con la cola llena la API responde `503` y la placa no abre.
- **Pruebas de carga (k6, entorno de prueba):** N puertas leyendo QR distintos y el mismo QR en paralelo, con tráfico de app saturando; se mide la latencia p95 de la validación, la espera por conexión y la cantidad de `503`.

## Pendientes de la auditoría de W7 (no resueltos en esta ola)

- **M3, consumo por las señales de W12:** el conteo de repeticiones y de `qr.usado` por QR (§4.3) todavía no lo lee nadie; lo consumirán las señales del ADR 0030 §4.
- **M4, hora de la última repetición:** el listado muestra «×N» pero no cuándo fue la última repetición; se agrega con el detalle de repeticiones.
- **B2, clave foránea compuesta:** `repetido_de_id` apunta solo a `lecturas (id)`; una FK `(tenant_id, repetido_de_id)` garantizaría en la base que el original es de la misma cuenta (hoy lo asegura el repositorio de cuenta).
- **B3, anular un QR ya usado:** `anular` solo actúa sobre QR sin usar; anular uno ya consumido (para cortar una repetición dentro de la ventana) no existe y requiere una regla de negocio escrita.
