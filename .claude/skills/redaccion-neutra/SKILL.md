---
name: redaccion-neutra
description: Registro de idioma de AGROCOM Acceso — tuteo estándar, nunca voseo rioplatense ni "usted" formal, en todo texto visible al usuario. Usar antes de escribir o corregir cualquier texto de app/lib/l10n/*.arb, mensajes del display del controlador de puerta o cualquier texto en español visible.
---

# Redacción neutra — AGROCOM Acceso

Todo texto visible al usuario (labels, placeholders, mensajes de error/ayuda,
botones, confirmaciones) va en **tuteo estándar**: segunda persona singular
neutra ("Selecciona", "Confirma", "Elige"), sin pronombre explícito salvo que
suene forzado sin él.

**Nunca:**
- Voseo rioplatense ("Seleccioná", "Confirmás", "¿Confirmás...?").
- La forma formal de "usted" ("Seleccione", "Elija", "Confirme").

**Por qué:** AGROCOM Acceso arranca en Bolivia (Santa Cruz) (moneda Bs, timezone
America/La_Paz). Ni el voseo ni el "usted" formal son el registro esperado
para software de uso profesional ahí — el tuteo estándar es el término medio
neutro, "menos intrusivo" (criterio heredado del proyecto base).

**Dónde vive:** `app/lib/l10n/app_es.arb` (ADR 0013). Nunca texto en español hardcodeado en un widget, un `SnackBar`, un diálogo ni un validador de formulario. Si hace falta un string nuevo, es una clave nueva en el ARB, con prefijo de la feature (`puertasTituloListado`, `qrAyudaBrillo`); lo compartido va con prefijo `comun`.

La **API no devuelve frases**: devuelve un `code` (`qr.vencido`) y la app lo traduce con la clave `error_qr_vencido`. El **firmware** muestra a lo sumo mensajes cortos en un display; si los tiene, viven en `firmware/src/config/textos.h` y siguen esta misma regla.

## Posesivos: lo institucional no es "tuyo"

No se le pone posesivo ("tu"/"mi") a un sustantivo institucional o compartido —portal, sistema, puerta del edificio—: ahí va artículo neutro ("Ingresa al sistema"). Sí se deja cuando la cosa es genuinamente del usuario: tu QR, tu acceso, tu contraseña.

## Cómo se escribe en el ARB

- Datos variables con placeholders ICU (`"Puerta {nombre}"`, con su entrada `@clave`), nunca concatenando pedazos de frase traducidos.
- Plurales con `{count, plural, =0{…} =1{…} other{…}}`.
- Cada clave lleva su `@clave` con `description`: es el contexto para quien traduzca.

## Lo que responde la plataforma también es texto

Mensajes de permisos del sistema operativo (cámara), los de `Info.plist` (`NSCameraUsageDescription`) y `AndroidManifest`, y los textos de la web (`index.html`, `manifest.json`) también van en tuteo.

## Compuertas automáticas

Un test de la app (`test/l10n/redaccion_neutra_test.dart`) recorre los ARB y falla ante voseo o trato de usted; otro (`test/l10n/textos_literales_test.dart`) busca `Text('…')` y strings literales visibles en `lib/`. No se debilitan para que pase un texto.

## Tabla de conversión voseo → tuteo

Verbos regulares (patrón `-á/-á(s)` → `-a/-as`, `-é(s)` → `-e/-es`, `-í(s)` →
`-e/-es` según conjugación):

| Voseo | Tuteo | | Voseo | Tuteo |
|---|---|---|---|---|
| Seleccioná | Selecciona | | Ingresá | Ingresa |
| Confirmá / Confirmás | Confirma / Confirmas | | Completá | Completa |
| Guardá | Guarda | | Agregá | Agrega |
| Cargá | Carga | | Eliminá | Elimina |
| Marcá | Marca | | Verificá | Verifica |
| Mirá | Mira | | Indicá | Indica |
| Buscá | Busca | | Cancelá | Cancela |
| Revisá | Revisa | | Corregí | Corrige |
| Actualizá | Actualiza | | Subí | Sube |
| Activá | Activa | | Desactivá | Desactiva |
| Adjuntá | Adjunta | | Repetí | Repite |
| Probá | Prueba | | Intentá | Intenta |
| Esperá | Espera | | Escribí | Escribe |
| Leé | Lee | | Elegí | Elige |
| Avisame | Avísame | | Fijate | Fíjate |
| Acordate | Acuérdate | | | |

Verbos irregulares (no siguen el patrón regular, ojo especial):

| Voseo | Tuteo |
|---|---|
| Volvé | Vuelve |
| Andá | Anda |
| Vení | Ven |
| Decí / Decime | Di / Dime |
| Salí | Sal |
| Hacé / Hacés | Haz / Haces |
| Poné | Pon |
| Tené / Tenés | Ten / Tienes |
| Sos | Eres |
| Podés | Puedes |
| Querés | Quieres |
| Necesitás | Necesitas |
| Sabés | Sabes |

**No tocar** — ya son correctas en tuteo, coinciden con voseo o son
impersonales/adverbios: "está" (3ra persona), "estás" (2da persona de
"estar", ya es tuteo), "quizá", "además", "acá", "allá". No son marcadores de
voseo aunque terminen en vocal acentuada.


