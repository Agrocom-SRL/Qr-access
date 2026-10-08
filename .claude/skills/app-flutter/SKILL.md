---
name: app-flutter
description: Mapa de la app Flutter de AGROCOM Acceso (Android, iOS y web) — estructura por feature, sistema de diseño en tokens (verde Santa Cruz), Riverpod, go_router, cliente de la API, l10n, pantallas de QR y escáner, reglas de pantalla y tests. Usar antes de escribir o cambiar código en app/.
---

# App Flutter — mapa de `app/`

ADR 0012 (estructura y diseño) y 0013 (textos). Diseño: `docs/diseno/sistema-diseno.md` y `docs/diseno/guia-pantallas.md`.

## Estructura

```
app/lib/
  main.dart                     arranque (ProviderScope, MaterialApp.router, tema, l10n)
  core/
    api/                        cliente dio + modelos generados del OpenAPI + interceptor de JWT/refresh
    config/                     entorno (--dart-define=API_URL=…)
    router/                     go_router + guardas por sesión y permiso
    theme/
      primitivos.dart           ÚNICOS valores literales de color (rampa verde Santa Cruz, neutros)
      tokens.dart               AccesoTokens (ThemeExtension): espaciado, radios, duraciones, semánticos
      tema.dart                 ThemeData claro y oscuro construidos desde los tokens
    plataforma/                 interfaces de cámara, almacenamiento seguro, brillo (impl. móvil/web)
    sesion/                     estado de sesión, rol activo, permisos
  shared/widgets/
    atoms/                      AccesoBoton, AccesoBadge, AccesoCampoTexto, AccesoIcono…
    molecules/                  CampoFormulario, TarjetaIndicador, EstadoVacio, ConfirmarDialogo…
    organisms/                  ListadoPaginado, FormularioSecciones, EscanerQr…
    templates/                  PlantillaAdmin (rail/drawer + cabecera), PlantillaAuth
  features/
    sesion/                     login, elegir rol, perfil
    mi_qr/                      QR personal dinámico (pantalla completa, brillo al máximo)
    escaner/                    escáner de guardia (cámara) → valida contra la API
    puertas/  sitios/  personas/  reglas/  invitaciones/  eventos/  dispositivos/  cuentas/
      data/                     repositorio de la feature (usa core/api)
      domain/                   modelos y lógica pura (testeable sin Flutter)
      presentation/             pantallas, widgets propios y providers
      <feature>.dart            lo único que otras features pueden importar
  l10n/app_es.arb
```

## Paquetes de referencia

`flutter_riverpod`, `go_router`, `dio`, `flutter_secure_storage`, `qr_flutter` (mostrar), `mobile_scanner` (escanear, móvil y web), `crypto` (HMAC del QR dinámico), `intl`, `very_good_analysis` (lints). Versiones fijadas en `pubspec.lock`, que se versiona.

## Reglas

1. **Tokens siempre**: `context.tokens.espacio.m`, `Theme.of(context).colorScheme.primary`. Prohibido `Color(0x…)`, `Colors.green`, `EdgeInsets.all(13)` en un widget. Lo controla `test/arquitectura/tokens_test.dart`.
2. **Textos siempre del ARB** (`context.l10n.puertasTitulo`), en tuteo.
3. **Una feature no importa archivos internos de otra**: solo su `<feature>.dart`. Lo controla `test/arquitectura/fronteras_test.dart`.
4. **Ningún widget llama a la red**: presentation → provider → repositorio de `data/` → `core/api`.
5. **Web y móvil comparten código**: nada de `dart:io` fuera de `core/plataforma/*_movil.dart`; elegir implementación con import condicional.
6. **QR**: negro sobre blanco, tamaño mínimo 240 dp, zona de silencio, brillo al máximo mientras se muestra, regenerado cada `QR_PASO_SEGUNDOS` con cuenta regresiva visible (ADR 0008).
7. **Errores de la API**: se traducen por `code` (`error_qr_vencido`); un `code` desconocido muestra el genérico.

## Reglas de pantalla (de ACRECIA, `guia-pantallas.md`)

- Arquetipos: **Tablero**, **Listado**, **Formulario**, **Detalle**, más los propios: **Mi QR** y **Escáner**.
- Tras guardar, el formulario se queda en edición (no vuelve al listado).
- `activo` nunca va en un formulario: se activa/desactiva con una acción aparte.
- Colores fijos de acción: Ver = info, Editar = advertencia, Eliminar = peligro; un cambio de estado lleva el color del estado destino. Toda baja o cambio de estado confirma con `ConfirmarDialogo`.

## Tests

- `test/features/<feature>/domain/*` unitarios; `presentation/*` widget tests con el repositorio sustituido por un fake con el **shape real** de la API.
- `test/l10n/` (redacción neutra, textos literales) y `test/arquitectura/` (tokens, fronteras).
