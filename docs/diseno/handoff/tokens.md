# Tokens de diseño V1 (handoff)

Parámetros del sistema de diseño tal como los entregó el handoff. Es **documentación**, no código: la implementación vive en `app/lib/core/theme/` (`primitivos.dart` con los literales, `tokens.dart` con los semánticos y las medidas, `tema.dart` con el `ThemeData`). Si un valor cambia acá, cambia allá, y viceversa; `docs/diseno/sistema-diseno.md` es el documento que explica el porqué.

## Rampa verde (bandera de Santa Cruz; hex provisional, D-08)

| Paso | Hex |
|---|---|
| 50 | `#E8F5EE` |
| 100 | `#C5E6D2` |
| 200 | `#93D0AB` |
| 300 | `#5CB683` |
| 400 | `#2B9A5D` |
| 500 | `#007A33` |
| 600 | `#006B2D` |
| 700 | `#005824` |
| 800 | `#00451C` |
| 900 | `#002F13` |

## Colores semánticos (tema claro / oscuro)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `fondo` | `#F5F7F6` | `#121614` | Fondo de pantalla |
| `superficie` | `#FFFFFF` | `#1C211E` | Tarjetas, campos, barra de navegación |
| `superficieElevada`* | `#FFFFFF` | `#242A26` | Diálogos y menús |
| `borde` | `#DDE2DF` | `#2C332E` | Bordes y separadores |
| `texto` | `#1B1F1C` | `#E6EAE7` | Texto principal |
| `textoSecundario` | `#5B635D` | `#A3ABA5` | Texto de apoyo, íconos inactivos |
| `primario` | `#007A33` | `#5CB683` | Acción principal, selección |
| `primarioHover`* | `#006B2D` | `#93D0AB` | Hover y pulsado del primario |
| `sobrePrimario`* | `#FFFFFF` | `#002F13` | Texto sobre primario |
| `primarioSuave` | `#E8F5EE` | `#002F13` | Fondo tonal (badges, cajas de ícono, indicador de navegación) |
| `peligro` | `#C62828` | `#EF7A7A` | Rechazado, sin conexión, eliminar |
| `peligroSuave`* | `#FDECEC` | `#3A1C1C` | Fondo tonal de peligro |
| `advertencia` | `#965A00` | `#F2B54A` | Vencido, avisos |
| `advertenciaSuave`* | `#FFF3E0` | `#33270F` | Fondo tonal de advertencia |
| `informacion` | `#1565C0` | `#7EB6F2` | Usado, ver |
| `informacionSuave`* | `#E8F1FB` | `#14263A` | Fondo tonal de información |
| `hero`* | `#007A33` | `#00451C` | Bloque de marca (bienvenida, tarjeta de cuenta, "Emitir QR") |
| `heroAcento`* | `#006B2D` | `#005824` | Caja de ícono y badge sobre el hero |

\* Token propuesto por el handoff. Alias de dominio: `accesoPermitido = primario`, `accesoDenegado = peligro`. El QR no se tematiza: módulos `#000000` sobre `#FFFFFF` en los dos temas.

## Elevación

| Token | Claro | Oscuro |
|---|---|---|
| `elev1` (tarjeta) | `0 1px 2px rgba(27,31,28,.06)`, `0 1px 3px rgba(27,31,28,.06)` | sin sombra: el color es `superficie` |
| `elev3` (diálogo, menú) | `0 8px 24px rgba(27,31,28,.10)`, `0 2px 4px rgba(27,31,28,.04)` | sin sombra: el color es `superficieElevada` |

## Tipografía

- **IBM Plex Sans** para texto; **IBM Plex Mono** para PIN, códigos, horas y cifras, con cifras tabulares (`FontFeature.tabularFigures()`).
- Tamaños: 12 · 14 · 16 (cuerpo) · 20 · 24 · 32. Pesos: 400 · 500 · 600.
- Interlineado: 1.3 en títulos, 1.5 en cuerpo.

| Estilo | Tamaño | Peso | Interlineado |
|---|---|---|---|
| `headlineLarge` | 32 | 600 | 1.3 |
| `headlineMedium` | 24 | 600 | 1.3 |
| `titleLarge` | 20 | 600 | 1.3 |
| `bodyLarge` | 16 | 400 | 1.5 |
| `bodyMedium` | 14 | 400 | 1.5 |
| `labelSmall` | 12 | 500 | — |

## Espaciado, radios y movimiento

| Grupo | Valores |
|---|---|
| Espaciado | 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 |
| Radios | 6 (chips) · 10 (campos, íconos) · 14 (tarjetas) · 20 (hero, diálogos) · completo (botones, badges) |
| Duraciones | 120 ms · 200 ms · 300 ms, curva `easeOutCubic`; con "reducir movimiento" (`MediaQuery.disableAnimationsOf`) pasan a 0 |

## Medidas de componente

No forman parte de la escala de espaciado: son constantes.

| Medida | Valor |
|---|---|
| Badge | 24 |
| Pastilla de filtro | 40 |
| Mínimo táctil | 44 |
| Botón y campo | 48 |
| Casilla de PIN | 36 × 56 en compacto, 44 × 56 en expandido |
| AppBar | 56 |
| FAB | 56 |
| Fila de perfil | 64 |
| NavigationBar | 80 |
| Rail | 80 (medio) · 240 (expandido) |
| Ancho máximo del contenido | 400 en auth · 720 en formularios · 1200 en listas y tableros |
| QR | mínimo 240 dp (320 en expandido) + 16 dp de zona de silencio |

## Breakpoints

| Clase | Ancho | Navegación |
|---|---|---|
| Compacto | < 600 | `NavigationBar` (máximo 4 destinos), listados en tarjetas |
| Medio | 600–1023 | `NavigationRail` de 80, tarjetas en 2 columnas |
| Expandido | ≥ 1024 | rail extendido de 240, `DataTable` con paginación de 20, formularios centrados, tableros en grilla de 12 |

## Correspondencia con Material 3

Cómo se vuelcan los semánticos al `ThemeData` (lo que el handoff proponía como punto de partida):

| Material 3 | Token |
|---|---|
| `colorScheme.primary` / `onPrimary` | `primario` / `sobrePrimario` |
| `colorScheme.primaryContainer` / `onPrimaryContainer` | `primarioSuave` / `primario` |
| `colorScheme.secondary` / `onSecondary` | `primario` / `sobrePrimario` |
| `colorScheme.error` / `onError` | `peligro` / blanco en claro, `#3A1C1C` en oscuro |
| `colorScheme.surface` / `onSurface` / `onSurfaceVariant` | `superficie` / `texto` / `textoSecundario` |
| `colorScheme.outline` / `outlineVariant` | `borde` |
| `scaffoldBackgroundColor` | `fondo` |
| `FilledButton` | alto 48, `StadiumBorder`, texto 16 / 600 |
| `InputDecoration` | relleno `superficie`, radio 10, borde `borde`; foco `primario` 2 dp; error `peligro` 2 dp |
| `Card` | `superficie`, elevación 0, radio 14 |
| `Dialog` | `superficieElevada`, radio 20 |
| `NavigationBar` | `superficie`, indicador `primarioSuave`, alto 80 |
| `NavigationRail` | `superficie`, indicador `primarioSuave` |
| `materialTapTargetSize` | `padded` |
