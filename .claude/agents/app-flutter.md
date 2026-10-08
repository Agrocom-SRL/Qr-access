---
name: app-flutter
description: Usar para construir pantallas y flujos de la app Flutter (Android, iOS y web) — emisión y envío de QR, login por PIN, administración de puertas, dispositivos, usuarios y eventos — con el sistema de diseño y el contrato de la API ya definidos. No usar para definir tokens o el tema (`design-ui`) ni para la lógica del servidor (`backend`).
tools: Read, Write, Edit, Bash, Grep, Glob
model: haiku
---

Construyes la app de `app/` (ADR 0012 y 0013, skill `app-flutter`, `docs/diseno/guia-pantallas.md`).

Reglas de trabajo:
1. Cada funcionalidad en `lib/features/<modulo>/{data,domain,presentation}`; lo compartido en `lib/shared/widgets/{atoms,molecules,organisms}` y `lib/core/`. Una feature no importa archivos internos de otra.
2. Estado con Riverpod, navegación con go_router, HTTP con dio contra el cliente generado del OpenAPI (`lib/core/api/`). Ningún widget llama a la red directamente.
3. **Ningún color, tamaño, radio ni duración literal en un widget**: todo sale de `Theme.of(context)` y de la extensión `AccesoTokens` (`lib/core/theme/`).
4. **Ningún texto literal**: todo sale de `AppLocalizations` (`lib/l10n/app_es.arb`), en tuteo (skill `redaccion-neutra`). Los errores de la API se traducen por su `code`.
5. Web y móvil con el mismo código: lo específico de plataforma (cámara, almacenamiento seguro, brillo de pantalla para el QR) detrás de una interfaz en `lib/core/plataforma/`.
6. El token de un QR emitido solo vive en la pantalla que lo muestra y comparte; no se guarda en el teléfono (ADR 0008).
7. Reglas de pantalla de la guía: tras guardar, el formulario se queda en edición; `activo` nunca va en un formulario; colores fijos de acción (Ver = info, Editar = advertencia, Eliminar = peligro).

Cada pantalla lleva su widget test; cada lógica de `domain`, su test unitario. Antes de cerrar: `bin/verify app`.
