# Handoff: AGROCOM Acceso (V1)

## Resumen
App de control de acceso a puertas eléctricas con QR de un solo uso. Funciona en Android y en web responsive y se construye con Flutter + Material 3. Es multitenant: cada cuenta es una empresa con sus sitios, puertas y usuarios. El usuario entra solo con un PIN de 7 caracteres (`AGR7K2Q`: 3 letras de cuenta + 4 alfanuméricos), emite un QR para una o más puertas y lo comparte como imagen.

## Sobre los archivos de diseño
Los `.dc.html` de `diseño/` son **referencias de diseño hechas en HTML**. Muestran el aspecto y el comportamiento esperados; no son código de producción. Hay que **recrearlos en Flutter** con widgets de Material 3, `ThemeData` y `ThemeExtension`. Para verlos, abre cada archivo en un navegador (necesitan `support.js` en la misma carpeta).

| Archivo | Contenido |
|---|---|
| `Sistema de Diseño.dc.html` | Tokens (claro/oscuro) y componentes con estados |
| `Pantallas Compacto.dc.html` | 360×800: marcos C01–C10c y oscuro D02, D04, D06 |
| `Pantallas Expandido.dc.html` | 1440×900: E01–E10b y oscuro DE02, DE04, DE06 |
| `Estados.dc.html` | Carga, vacío, error y sin conexión (L1a–L4d, S01–S06, T1–T4) |
| `Handoff.dc.html` | Componentes y tokens por pantalla |

### Capturas (`capturas/`)
PNG de cada pantalla, nombradas con su id (por ejemplo `C04a_inicio_usuario.png`):
- `compacto/`: 720×1600, es decir 360×800 a 2x.
- `expandido/`: 1440×900 a 1x.
- `estados/`: hojas completas de los estados.
- `sistema_de_diseno.png`: página del sistema de diseño.

Claude Code puede leerlas directamente. Pásale la captura junto con el id del marco y esta especificación.

## Fidelidad
**Alta fidelidad.** Colores, tipografía, espaciado, radios y textos son finales. Los datos de ejemplo, el logo (marcador rayado) y el patrón QR (no escaneable) son de muestra.

## Tokens
Los valores completos, con su correspondencia a Material 3, están en `tokens.md`. La implementación vive en `app/lib/core/theme/`.

### Color, tema claro / oscuro
| Token | Claro | Oscuro |
|---|---|---|
| fondo | #F5F7F6 | #121614 |
| superficie | #FFFFFF | #1C211E |
| superficieElevada* | #FFFFFF | #242A26 |
| borde | #DDE2DF | #2C332E |
| texto | #1B1F1C | #E6EAE7 |
| textoSecundario | #5B635D | #A3ABA5 |
| primario | #007A33 | #5CB683 |
| primarioHover* | #006B2D | #93D0AB |
| sobrePrimario* | #FFFFFF | #002F13 |
| primarioSuave | #E8F5EE | #002F13 |
| peligro | #C62828 | #EF7A7A |
| peligroSuave* | #FDECEC | #3A1C1C |
| advertencia | #965A00 | #F2B54A |
| advertenciaSuave* | #FFF3E0 | #33270F |
| informacion | #1565C0 | #7EB6F2 |
| informacionSuave* | #E8F1FB | #14263A |
| hero* | #007A33 | #00451C |
| heroAcento* | #006B2D | #005824 |

\* Token propuesto en este diseño. accesoPermitido = primario; accesoDenegado = peligro.
Rampa verde: 50 #E8F5EE · 100 #C5E6D2 · 200 #93D0AB · 300 #5CB683 · 400 #2B9A5D · 500 #007A33 · 600 #006B2D · 700 #005824 · 800 #00451C · 900 #002F13.

### Tipografía
- IBM Plex Sans para texto. IBM Plex Mono para PIN, códigos, horas y cifras (con `FontFeature.tabularFigures()`).
- Tamaños 12 · 14 · 16 (cuerpo) · 20 · 24 · 32. Pesos 400 / 500 / 600. Interlineado 1.3 en títulos y 1.5 en cuerpo.

### Espaciado, radios, elevación y movimiento
- Espaciado: 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Radios: 6 (chips) · 10 (campos, íconos) · 14 (tarjetas) · 20 (hero, diálogos) · completo (botones, badges).
- Elevación en claro: elev1 = `0 1px 2px rgba(27,31,28,.06), 0 1px 3px rgba(27,31,28,.06)`; elev3 = `0 8px 24px rgba(27,31,28,.10), 0 2px 4px rgba(27,31,28,.04)`. En oscuro no hay sombra: se usa superficie (elev1) y superficieElevada (elev3).
- Movimiento: 120 / 200 / 300 ms con `Curves.easeOutCubic`. Con `MediaQuery.disableAnimationsOf(context)` la duración pasa a 0.

### Medidas de componente
No forman parte de la escala de espaciado; son constantes:
- Badge 24. Pastilla de filtro 40. Mínimo táctil 44. Botón y campo 48. Casilla de PIN 36×56 (44×56 en expandido).
- AppBar 56. FAB 56. Fila de perfil 64. NavigationBar 80.
- Rail 80 (medio) / 240 (expandido).
- Ancho máximo del contenido: 400 en auth, 720 en formularios, 1200 en listas y tableros.

## Breakpoints y navegación
- **compacto < 600**: `NavigationBar` (máx. 4 destinos) y listados como tarjetas.
- **medio 600–1023**: `NavigationRail` de 80 y tarjetas en 2 columnas.
- **expandido ≥ 1024**: rail extendido de 240, `DataTable` con paginación de 20, formularios centrados y tableros en grilla de 12.

Recomendamos `NavigationBar` en lugar de drawer: cada rol tiene 4 destinos o menos, de uso frecuente, siempre visibles y al alcance del pulgar.

| Rol | Compacto | Rail |
|---|---|---|
| Usuario | Inicio · Mis QR · Eventos · Perfil | + Emitir QR |
| Guardia | Inicio · Eventos · Puertas · Perfil | igual |
| Administrador | Inicio · Eventos · Admin · Perfil | Inicio · Emitir QR · Eventos · Puertas · Usuarios · Perfil |

## Componentes (nombres obligatorios)
- **Átomos**: AccesoBoton (primario, secundario, texto, peligro tonal / relleno), AccesoBadge, AccesoCampoTexto, AccesoSelector, AccesoInterruptor.
- **Moléculas**: CampoFormulario, TarjetaIndicador, EstadoVacio, ConfirmarDialogo, FilaClaveValor.
- **Organismos**: ListadoPaginado, FormularioSecciones, VisorQr.
- **Plantillas**: PlantillaAuth, PlantillaAdmin, PlantillaPantallaCompleta.

Estados de cada componente: normal, hover (primario → primarioHover), foco (contorno de 2 a 2 de distancia), deshabilitado (fondo borde, texto textoSecundario), carga (spinner de 16 + verbo en gerundio) y error (borde peligro de 2 + mensaje con ícono).

Badges, siempre con punto + texto:
- Vigente = primario. Usado = informacion. Vencido = advertencia. Anulado = textoSecundario sobre fondo con borde.
- Permitido = primario. Rechazado = peligro. En línea = primario. Sin conexión = peligro.

Acciones de fila con color fijo: Ver = informacion, Editar = advertencia, Eliminar = peligro.

## Pantallas
1. **Bienvenida** (C01, E01): hero verde con logo y la frase "Abre las puertas de tu empresa con un QR de un solo uso.", botón "Ingresar" y la ayuda "¿No tienes PIN? Pídelo al administrador de tu cuenta."
2. **Ingreso con PIN** (C02–C02d, E02):
   - Usar un único `TextField` (maxLength 7, `TextCapitalization.characters`, filtro `[A-Z0-9]`, autocorrect off) con overlay visual de 3 + 4 casillas. Pegar `AGR-7K2Q` limpia el guion.
   - "Ingresar" queda deshabilitado hasta tener 7 caracteres. Botón Mostrar/Ocultar.
   - Errores: "PIN incorrecto" (borde peligro) y "Demasiados intentos, espera unos minutos." con cuenta regresiva.
3. **Elegir rol** (C03, E03): tarjetas seleccionables. Aparece solo si el usuario tiene 2 roles o más.
4. **Inicio**:
   - Usuario (C04a, E04a): hero "Emitir QR", 4 accesos rápidos y los QR vigentes de hoy.
   - Administrador (C04b, E04b): indicadores accesos de hoy / rechazados / puertas sin conexión, y últimos eventos.
5. **Emitir QR**, stepper de 3 pasos (C05a–c, E05):
   - Paso 1: puertas, selección múltiple agrupada por sitio.
   - Paso 2: vigencia ("Hasta el fin del día" por defecto; o 1 h / 4 h / hora) y etiqueta opcional (máx. 40).
   - Paso 3: confirmar.
6. **QR emitido** (C06, E06): VisorQr, puertas, etiqueta y "Vence hoy a las 23:59".
   - "Compartir" usa `share_plus` con PNG. En web: Web Share API, o descarga si no existe.
   - Aviso: no se podrá volver a ver. Al cerrar sin compartir pide confirmación (S05).
7. **Mis QR** (C07, C07b, E07): filtros Vigentes / Usados / Vencidos / Anulados. "Anular" abre ConfirmarDialogo con "Vigente → Anulado".
8. **Eventos** (C08, E08): hora, puerta, resultado y motivo ("QR vencido", "QR ya usado", "Otra puerta", "Suscripción vencida").
9. **Perfil** (C09, E09): cuenta y código, rol activo con "Cambiar rol", plan y vencimiento, tema oscuro y "Cerrar sesión" en peligro tonal.
10. **Administración**:
    - Puertas (C10a, E10a): sitio, dispositivo y estado.
    - Usuarios (C10b, E10b): etiqueta y roles.
    - "Generar PIN" (C10c, E10b) muestra el PIN una sola vez en mono 32, con "Copiar" y la advertencia.

Todo listado tiene estados de carga (skeleton con la forma real), vacío con acción, error con "Reintentar" y sin conexión (caché + banner). Ver `Estados.dc.html`.

## QR (no negociable)
- Siempre negro #000 sobre blanco #FFF, también en oscuro.
- Mínimo 240 dp (320 en expandido) + 16 dp de zona de silencio.
- Usar `qr_flutter`. La imagen compartida se genera con `RepaintBoundary`.

## Textos
Español con tuteo ("Ingresa tu PIN", "Comparte el QR"). Nunca voseo ni "usted". Usar las cadenas de los diseños tal cual; centralizarlas en ARB (`flutter_localizations`).

## Recursos
- Íconos: Material Symbols Outlined (en Flutter, `Icons.*_outlined` o el paquete `material_symbols_icons`).
- Fuentes: IBM Plex Sans y Mono con `google_fonts` o empaquetadas en assets.
- Logo: `app/assets/imagenes/logo_agrocom.png` (en los diseños aparece un marcador rayado). Es apaisado y va sobre una placa blanca, también en oscuro y sobre el hero.
