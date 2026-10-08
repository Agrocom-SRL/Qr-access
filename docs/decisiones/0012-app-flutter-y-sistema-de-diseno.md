# ADR 0012 — App Flutter: estructura por feature y sistema de diseño por tokens

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0002 de ACRECIA (Atomic Design + tokens), traducido a Flutter.

## Contexto

Una sola app debe servir a tres públicos —la persona que muestra su QR, el guardia que escanea y el administrador que gestiona puertas y reglas— en Android, iOS y web. En ACRECIA, la regla "ningún color fuera de un token" y el catálogo Atomic Design mantuvieron el panel homogéneo con varios agentes escribiendo pantallas.

## Decisión

- **Flutter estable**, un solo código para Android, iOS y web.
- **Estructura por feature** (`lib/features/<feature>/{data,domain,presentation}`) con `core/` y `shared/` transversales (ADR 0003, skill `app-flutter`).
- **Estado**: Riverpod. **Navegación**: go_router con guardas por sesión y permiso. **HTTP**: dio + cliente generado del OpenAPI.
- **Sistema de diseño en tres capas de tokens**: primitivos (`primitivos.dart`, único lugar con hex) → semánticos por tema claro/oscuro → `ThemeData` + `ThemeExtension` (`AccesoTokens`). Ningún widget usa un color, tamaño, radio o duración literal.
- **Marca**: predomina el **verde de la bandera de Santa Cruz** con blanco (`docs/diseno/sistema-diseno.md`). Material 3 como base de componentes, ajustado con los tokens.
- **Atomic Design** en `shared/widgets/{atoms,molecules,organisms,templates}`.
- **Plantillas**: `PlantillaAdmin` (rail en web/tablet, drawer en móvil, cabecera con rol activo) y `PlantillaAuth`. La experiencia del usuario final (Mi QR) es de pantalla completa y mínima.
- **Lints**: `very_good_analysis`; `flutter analyze --fatal-infos` en la compuerta.

## Alternativas descartadas

- **Dos apps (móvil y panel web separado)**: duplica pantallas y sistema de diseño.
- **Bloc**: sólido, pero más ceremonia que Riverpod para este tamaño.
- **Estructura por capa técnica** (`screens/`, `services/`): dispersa una funcionalidad.

## Consecuencias

- Tests de arquitectura en `app/test/arquitectura/` (tokens y fronteras) desde el primer commit de la app.
- Cambiar la marca es editar `primitivos.dart` y nada más.
