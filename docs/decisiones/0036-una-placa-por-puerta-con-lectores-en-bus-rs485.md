# ADR 0036 — Una placa por puerta, con uno o dos lectores en un bus RS485

**Estado:** Propuesta (2026-10-30), con Miguel. Reemplazaría el §4 del ADR 0035 («una placa por lector») **cuando se cumplan las dos condiciones de abajo**: la prueba de banco y las respuestas del dueño del condominio. Hasta entonces el §4 del ADR 0035 sigue vigente.

## Contexto

El ADR 0035 §4 descartó «una placa con dos lectores» porque la ESP32-ETH01 no tiene pines libres para un segundo lector, y dejó el modelo de **una placa por lector** (dos placas, dos relés en paralelo, `dispositivos.sentido`, unicidad por ubicación).

Pero el lector de la mesa de trabajo es **RS485** (`docs/hardware/README.md`): llega a la placa por un MAX485 con **solo recepción** (RE y DE a GND) en un único GPIO (GPIO5). RS485 es un bus multipunto: varios lectores pueden compartir el mismo par A/B, así que **el segundo lector no necesita otro pin**. El límite de hardware que motivó el §4 desaparece.

Además, la plataforma no registra quién entró ni quién salió: solo **cuándo y cuántas veces se abrió la puerta**. Saber de qué lado leyó cada lector no aporta nada que se muestre o se decida.

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

### 4. Mientras la puerta está abierta (por definir con el dueño del condominio)

Propuesta de partida, **sujeta a las respuestas de abajo**: si llega una lectura **válida** mientras el pulso está activo, el pulso se **extiende** (hasta un tope, nunca más que el máximo del firmware) en vez de lanzar otro aparte. En puertas vehiculares, la palanca principal es `segundos_apertura` (hoy de 1 a 30 s).

Sigue valiendo el QR de un solo uso (invariante 3): si la persona 1 gasta su QR y entra la persona 2, la persona 1 genera otro. No se cambia.

### 5. Falla de la placa

Una sola placa es un **punto único de falla**: si cae, caen los dos lados de lectura (sigue el pulsador de salida y la llave mecánica, ADR 0009). La detección ya existe (ADR 0031 §18): a los 15 min sin latido, aviso a AGROCOM y al propietario; a las 2 h, aviso a AGROCOM de **revisar físicamente la placa**. No se agrega nada.

## Condiciones para aceptarla

1. **Prueba de banco:** dos lectores en el mismo bus A/B con la misma placa. Verificar que (a) cada lectura llega íntegra, (b) dos lecturas simultáneas se descartan o se procesan en orden sin abrir por error, y (c) el formato de trama es el mismo en los dos lectores. Confirmar además el modelo exacto del lector (`docs/hardware/README.md` lo tiene sin confirmar).
2. **Respuestas del dueño del condominio** (ver abajo).

## Preguntas abiertas para el dueño del condominio

1. En el portón vehicular, ¿se cruzan dos autos a la vez (uno entra y otro sale)? ¿Qué debería pasar?
2. ¿Cuántos segundos debe quedar abierto el portón vehicular y la puerta peatonal?
3. ¿Es aceptable que quien ve su QR ya consumido (porque entró otra persona) tenga que generar otro?
4. Con dos lecturas casi simultáneas, ¿se atiende por orden de llegada, o alguna debe tener prioridad?

## Alternativas descartadas

- **Dos placas por puerta (ADR 0035 §4):** más hardware, dos relés en paralelo y dos placas compitiendo por la orden manual, para guardar un dato (el sentido) que nadie usa.
- **Un segundo MAX485 en otro pin de entrada:** funciona, pero añade hardware y asume pines libres que la ESP32-ETH01 casi no tiene; el bus compartido no los necesita.
- **Lectores con dirección propia para distinguirlos:** innecesario mientras no se registre la dirección, y dependería de que el modelo de lector lo soporte.

## Consecuencias

- **Base (ola futura):** quitar `dispositivos.sentido` y su unicidad (migración con `down`; datos de prueba).
- **API y panel:** retirar `sentido` de vincular placa y de los contratos, y el selector «ubicación del lector» del panel (AM1/AM4). Cambio incompatible: se hace sin romper `/api/v1` mientras no haya clientes publicados que lo usen, o se marca como obsoleto.
- **Firmware:** serialización de lecturas con cola corta, descarte de tramas corruptas, y (si se aprueba el §4) extensión del pulso con tope. Revisión línea por línea (acciona la cerradura).
- **Hardware:** `docs/hardware/README.md` documenta el bus de dos lectores (cableado, terminación y tierra común).
- **Tests obligatorios:** dos lecturas simultáneas → una sola validación a la vez y ninguna abre por una trama corrupta; lectura válida durante el pulso → extensión con tope (si se aprueba); sin red no abre; QR ya usado sigue rechazado.
