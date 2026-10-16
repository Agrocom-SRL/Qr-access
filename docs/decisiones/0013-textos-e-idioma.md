# ADR 0013 — Textos de interfaz en ARB desde el día uno, español por defecto

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0013 de ACRECIA.

## Decisión

1. **Ningún texto visible hardcodeado** en la app: todo pasa por `flutter_localizations` + `gen-l10n` desde `app/lib/l10n/app_es.arb`.
2. **Español como idioma por defecto y único en V1**; las claves en camelCase con prefijo de feature.
3. **La API no devuelve frases**: devuelve `code` (`qr.vencido`) y la app lo traduce (`error_qr_vencido`). Un `code` sin traducción muestra el mensaje genérico.
4. **Tuteo estándar** en todo texto visible (skill `redaccion-neutra`), incluidos los textos de permisos del sistema operativo y del display del dispositivo si lo hubiera.
5. El dominio no se traduce: tablas, enums y valores guardados quedan en español.

## Consecuencias

- `app/test/l10n/redaccion_neutra_test.dart` (voseo o usted en los ARB) y `textos_literales_test.dart` (texto literal en `lib/`) corren en `bin/verify`.
- Agregar un idioma es agregar `app_<idioma>.arb`.
