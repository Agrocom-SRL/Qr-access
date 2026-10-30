# ADR 0036 — Una placa por puerta, con uno o dos lectores en un bus RS485

**Estado:** Propuesta (2026-10-30, ajustada el mismo día con lo que informó el condominio), con Miguel. Reemplazaría el §4 del ADR 0035 («una placa por lector») **cuando se cumplan las condiciones de abajo**: la prueba de banco con los dos lectores (aún no se tiene el segundo lector físico) y las preguntas abiertas que quedan. Hasta entonces el §4 del ADR 0035 sigue vigente.

## Contexto

El ADR 0035 §4 descartó «una placa con dos lectores» porque la ESP32-ETH01 no tiene pines libres para un segundo lector, y dejó el modelo de **una placa por lector** (dos placas, dos relés en paralelo, `dispositivos.sentido`, unicidad por ubicación).

Pero el lector de la mesa de trabajo es **RS485** (`docs/hardware/README.md`): llega a la placa por un MAX485 con **solo recepción** (RE y DE a GND) en un único GPIO (GPIO5). RS485 es un bus multipunto: varios lectores pueden compartir el mismo par A/B, así que **el segundo lector no necesita otro pin**. El límite de hardware que motivó el §4 desaparece.

Además, la plataforma no registra quién entró ni quién salió: solo **cuándo y cuántas veces se abrió la puerta**. Saber de qué lado leyó cada lector no aporta nada que se muestre o se decida.

Y los portones **tienen su propio sensor y su propio control del tiempo abierto**: abren y cierran según el paso de vehículos o personas. La plataforma **no decide cuánto queda abierta la puerta**: solo envía un pulso que dice «ábrete».

## Decisión

### 1. Una placa por puerta, con uno o dos lectores en el mismo bus

La puerta lleva **una sola placa, un solo relé y un solo cable de red**. Los lectores (adentro y afuera, o uno solo) se conectan en paralelo al mismo par A/B del módulo RS485: A con A y B con B, en cadena sobre el cable (sin ramales largos), con tierra común con la placa y terminación de 120 Ω en los dos extremos. Cada lector puede tener su propia fuente.

Para la placa son **una sola fuente de lecturas**: no distingue cuál lector envió el QR. Lee, pregunta al servidor, y si la respuesta es positiva da el pulso, como hoy (invariante 2: nada cambia en la falla segura).

### 2. Se retira la ubicación del lector (`sentido`)

Como no se registra la dirección, `dispositivos.sentido`, su selector en el panel y la unicidad `uq_dispositivos_puerta_sentido` **dejan de tener razón de ser**: vuelve la regla de **un dispositivo en servicio por puerta** (`uq_dispositivos_puerta`). Los datos de local y producción son de prueba, así que se puede reestructurar.

La apertura manual (ADR 0035 §3) se simplifica: la orden la toma **la única placa de la puerta**; desaparece el caso de dos placas compitiendo por ella y el de dos relés en paralelo.

### 3. La placa atiende una lectura a la vez

El firmware **serializa**: mientras valida una lectura o mantiene el pulso, no inicia otra validación; las lecturas que llegan en ese lapso se atienden **en orden de llegada** (cola corta, con tope). Si dos lectores leen casi a la vez, se procesan una tras otra. Dos tramas que se pisan en el bus llegan corruptas y el firmware las **descarta** (falla segura: no abre); la persona vuelve a escanear.

El antirrebote del mismo texto y la ventana de repetición de 15 s del ADR 0032 §4 siguen igual.

### 4. Nosotros solo damos el pulso; el tiempo abierto lo manda el sensor del portón

El relé da un **pulso corto** de apertura y nada más. Cuánto queda abierto el portón lo decide su propio sensor (paso de vehículos o personas). Por eso `segundos_apertura` es **la duración del pulso**, no el tiempo abierto: en un portón con control propio debe ser corto.

Con dos lecturas válidas seguidas (por ejemplo, un lector de cada lado):

- La **primera** valida y pulsa de inmediato.
- La **segunda** también se valida y se consume en el servidor (invariante 3), pero **su pulso espera a que la puerta se cierre** y entonces se envía. No se extiende ni se repite el pulso de la primera.
- El pulso en espera **vence** si el portón no se cierra en un tope (por definir): una orden vencida no abre (invariante 2) y queda registrada como no ejecutada en `confirmaciones_apertura`.

Para esperar al cierre la placa necesita **saber que la puerta está cerrada** (ver las preguntas abiertas). Sigue valiendo el QR de un solo uso: si la persona 1 gasta su QR y entra la persona 2, la persona 1 genera otro.

### 5. Falla de la placa

Una sola placa es un **punto único de falla**: si cae, caen los dos lados de lectura (sigue el pulsador de salida y la llave mecánica, ADR 0009). La detección ya existe (ADR 0031 §18): a los 15 min sin latido, aviso a AGROCOM y al propietario; a las 2 h, aviso a AGROCOM de **revisar físicamente la placa**. No se agrega nada.

## Condiciones para aceptarla

1. **Prueba de banco, cuando se tenga el segundo lector físico:** dos lectores en el mismo bus A/B con la misma placa. Verificar que (a) cada lectura llega íntegra, (b) dos lecturas simultáneas se descartan o se procesan en orden sin abrir por error, (c) el formato de trama es el mismo en los dos lectores y (d) el segundo pulso espera al cierre de la puerta. Confirmar además el modelo exacto del lector (`docs/hardware/README.md` lo tiene sin confirmar). **Hasta entonces no se implementa nada de esta decisión.**
2. **Cerrar las preguntas abiertas** de abajo.

## Resueltas (informó el condominio, 2026-10-30)

- **Cruce de dos autos y tiempo abierto del portón:** lo maneja el sensor propio del portón; la plataforma no controla la duración (§4).

## Preguntas abiertas

1. **¿De dónde sale la señal de «puerta cerrada»?** Opciones: el contacto de la propia placa (`sensor_puerta`, hoy opcional y con polaridad pendiente de confirmar en campo, `docs/hardware/README.md`) o un contacto seco del control del portón. Sin esa señal la placa no puede esperar al cierre; sin ella, el segundo pulso saldría con una separación fija (por definir).
2. **¿Cuánto esperar el cierre** antes de dar por vencido el pulso en espera?
3. ¿Es aceptable que la segunda persona vea su QR consumido y la puerta tarde en abrir hasta que cierre la anterior?

## Alternativas descartadas

- **Dos placas por puerta (ADR 0035 §4):** más hardware, dos relés en paralelo y dos placas compitiendo por la orden manual, para guardar un dato (el sentido) que nadie usa.
- **Un segundo MAX485 en otro pin de entrada:** funciona, pero añade hardware y asume pines libres que la ESP32-ETH01 casi no tiene; el bus compartido no los necesita.
- **Lectores con dirección propia para distinguirlos:** innecesario mientras no se registre la dirección, y dependería de que el modelo de lector lo soporte.

## Consecuencias

- **Base (ola futura):** quitar `dispositivos.sentido` y su unicidad (migración con `down`; datos de prueba).
- **API y panel:** retirar `sentido` de vincular placa y de los contratos, y el selector «ubicación del lector» del panel (AM1/AM4). Cambio incompatible: se hace sin romper `/api/v1` mientras no haya clientes publicados que lo usen, o se marca como obsoleto.
- **Firmware:** serialización de lecturas con cola corta, descarte de tramas corruptas y pulso en espera hasta el cierre, con vencimiento. Revisión línea por línea (acciona la cerradura).
- **Hardware:** `docs/hardware/README.md` documenta el bus de dos lectores (cableado, terminación y tierra común).
- **Tests obligatorios:** dos lecturas simultáneas → una sola validación a la vez y ninguna abre por una trama corrupta; segunda lectura válida con la puerta abierta → su pulso sale al cerrarse, y vence si no se cierra; sin red no abre; QR ya usado sigue rechazado.
