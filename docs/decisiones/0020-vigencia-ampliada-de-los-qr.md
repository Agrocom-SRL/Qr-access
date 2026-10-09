# ADR 0020 — Vigencia ampliada de los QR (horas y días)

**Estado:** Propuesta (2026-10-09) · Precisa el ADR 0008 §3 (emisión) y se apoya en el ADR 0017 (`max_vigencia_qr_horas`).

## Contexto

El ADR 0008 §3 dice que la API calcula `vence_at` "por defecto, el fin del día local del sitio, sin pasar nunca la vigencia máxima del plan". El código lo cumplía de más: tomaba el fin del día como **tope**, no solo como valor por defecto, así que una persona solo podía pedir una vigencia **menor** que el resto del día. Una vigencia de 12 h emitida por la tarde, o de varios días para una visita que llega la semana próxima, se rechazaba con `qr.vigencia_excedida`.

La invariante 3 de `CLAUDE.md` no pedía eso: "vencimiento (por defecto, fin del día; nunca más que el máximo del plan)".

## Decisión

1. **Por defecto**, sin `vence_at`: el fin del día local del sitio (el más próximo si las puertas están en zonas distintas), sin pasar el máximo.
2. **Máximo** de lo que se puede pedir: `max_vigencia_qr_horas` del plan; con el plan en `NULL` ("sin límite", ADR 0017), el **techo del sistema** de 168 h (7 días). Ningún QR vence más allá de ese techo.
3. Un QR sigue siendo de un solo uso y se consume de forma atómica (ADR 0008): una vigencia más larga no cambia eso, solo cuánto tiempo puede esperar sin usarse.
4. La app ofrece, por modo: **horas** (1, 2, 4, 8 · 12, 16, 20, 24, o una hora exacta del día; 2 h por defecto) o **días** (2, 3, 5, 7, o "todo el día"). No hay planes por tiempo de vida del QR: el límite es el del plan de la cuenta.

## Consecuencias

- Un QR emitido para varios días queda vigente más tiempo sin usarse: el riesgo de que alguien lo vea o lo copie es mayor. Se compensa con el uso único, la anulación desde Mis QR y el registro de todo intento (invariante 4).
- `vencimientoMaximo` (tope) y `vencimientoPorDefecto` (fin del día) quedan separados en `api/src/modules/accesos/domain/vencimiento.ts`.
- Subir el techo de 7 días exige otro ADR.
