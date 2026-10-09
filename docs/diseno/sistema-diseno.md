# Sistema de diseño — AGROCOM Acceso (Flutter)

**Origen:** principios de ACRECIA (tokens al origen, Atomic Design, marca en un solo archivo, motion motivado), traducidos a Flutter (ADR 0012). **Fuente de verdad de los valores y las pantallas:** el handoff V1 en `docs/diseno/handoff/` (`README.md`, los `.dc.html` de `diseño/` y las capturas por id en `capturas/`). Este documento resume cómo se materializa en el código.

## 1. Principios (no negociables)

1. **Tokens al origen.** Ningún color, tamaño, radio, sombra o duración se escribe suelto en un widget. Todo sale de `Theme.of(context)` y de `context.tokens` (`AccesoTokens`). Lo verifica `test/arquitectura/tokens_test.dart`.
2. **Tres capas**: primitivos (`lib/core/theme/primitivos.dart`, único lugar con hex) → semánticos por tema claro/oscuro (`ColoresSemanticos`) → `ThemeData` y componentes (`tema.dart`). Un widget solo lee semánticos.
3. **Marca en un solo archivo.** Cambiar la marca es editar `primitivos.dart`.
4. **Atomic Design**: átomos → moléculas → organismos → plantillas → pantallas (`lib/shared/widgets/{atoms,molecules,organisms,templates}`).
5. **Mock con el shape real**: los fakes de los tests devuelven exactamente lo que devuelve la API.
6. **Motion motivado** y respetando `MediaQuery.disableAnimationsOf` (`tokens.duracion.efectiva`).
7. **Una sola escala de breakpoints** (§2.7).
8. **El QR no se tematiza**: negro sobre blanco siempre, 240 dp (320 en expandido) más 16 dp de silencio.
9. **Textos en tuteo y solo del ARB** (`lib/l10n/app_es.arb`); se usan las cadenas del handoff tal cual.

## 2. Tokens

### 2.1 Color de marca — verde de la bandera de Santa Cruz

Base **`#007A33`** (D-08: hex provisional). Rampa `verde50 #E8F5EE · 100 #C5E6D2 · 200 #93D0AB · 300 #5CB683 · 400 #2B9A5D · 500 #007A33 · 600 #006B2D · 700 #005824 · 800 #00451C · 900 #002F13`.

### 2.2 Semánticos (lo único que leen los widgets)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `fondo` | `#F5F7F6` | `#121614` | Fondo de pantalla |
| `superficie` | `#FFFFFF` | `#1C211E` | Tarjetas, campos, barra de navegación |
| `superficieElevada` | `#FFFFFF` | `#242A26` | Diálogos y menús (en oscuro, la "sombra") |
| `borde` | `#DDE2DF` | `#2C332E` | Bordes de campos y separadores |
| `texto` | `#1B1F1C` | `#E6EAE7` | Texto principal |
| `textoSecundario` | `#5B635D` | `#A3ABA5` | Texto secundario, íconos de navegación inactivos |
| `primario` | `#007A33` | `#5CB683` | Acción principal, badges Vigente/Permitido/En línea |
| `primarioHover` | `#006B2D` | `#93D0AB` | Hover del primario |
| `sobrePrimario` | `#FFFFFF` | `#002F13` | Texto sobre primario (en oscuro, verde900: blanco daría 2.4:1) |
| `primarioSuave` | `#E8F5EE` | `#002F13` | Fondo de badge, selección, indicador de navegación |
| `peligro` / `peligroSuave` | `#C62828` / `#FDECEC` | `#EF7A7A` / `#3A1C1C` | Rechazado, Sin conexión, Eliminar, cerrar sesión |
| `advertencia` / `advertenciaSuave` | `#965A00` / `#FFF3E0` | `#F2B54A` / `#33270F` | Vencido, Editar, avisos "solo una vez", bloqueo del PIN |
| `informacion` / `informacionSuave` | `#1565C0` / `#E8F1FB` | `#7EB6F2` / `#14263A` | Usado, Ver, aviso informativo |
| `hero` / `heroAcento` / `sobreHero` | `#007A33` / `#006B2D` / `#FFFFFF` | `#00451C` / `#005824` / `#E6EAE7` | Bienvenida, tarjeta de cuenta, hero "Emitir QR", indicador de accesos de hoy |
| `elev1` / `elev3` | sombras del handoff | vacías | Tarjeta / diálogo (en oscuro la elevación es la superficie) |

Alias de dominio: `accesoPermitido = primario`, `accesoDenegado = peligro`, `qrModulo = #000000`, `qrFondo = #FFFFFF`. `ColorScheme` de Material 3 se arma desde estos semánticos (no con `fromSeed`). Contraste AA de todos los pares texto/fondo: `test/core/theme/tema_test.dart`.

### 2.3 Tipografía

**IBM Plex Sans** (texto) e **IBM Plex Mono** (PIN, códigos, horas y cifras, con `FontFeature.tabularFigures()`), empaquetadas en `app/assets/fuentes/` (licencia OFL ahí mismo), pesos 400 / 500 / 600. Escala 12 · 14 · 16 (cuerpo) · 20 · 24 · 32; interlineado 1.3 en títulos y 1.5 en cuerpo. Mono: `tokens.tipografia.mono(tamano, peso:, color:)`.

### 2.4 Espaciado, radios y movimiento

| Grupo | Tokens |
|---|---|
| Espaciado (base 4) | `espacio.xxs 2 · xs 4 · s 8 · m 12 · l 16 · xl 24 · xxl 32 · xxxl 48` |
| Radios | `radio.s 6` (chips) · `m 10` (campos, íconos) · `l 14` (tarjetas) · `xl 20` (hero, diálogos) · `completo` (botones, badges) |
| Duraciones | `duracion.rapida 120` (hover, foco, interruptor) · `normal 200` (pastillas, badges) · `lenta 300` (pasos, diálogos, rutas) · `pulso 1200` (skeleton); curva `Curves.easeOutCubic`; con "reducir movimiento", cero |

### 2.5 Medidas de componente (`tokens.tamano`)

No son espaciado: badge 24 · chip de paso e interruptor 32 · pastilla de filtro 40 · mínimo táctil 44 · botón y campo 48 · casilla del PIN 36×56 (44×56 en expandido) · app bar, FAB y acceso rápido 56 · fila de perfil 64 · NavigationBar 80 · rail 80 / 240 · ancho máximo 400 (auth), 640 (formulario de secciones), 720 (formularios), 1200 (listas y tableros) · resumen lateral 360 · QR 240 / 320 + 16 de silencio.

### 2.6 Breakpoints y navegación (`context.clasePantalla`)

`compacta < 600` (NavigationBar de hasta 4 destinos, listados en tarjetas) · `media 600–1023` (NavigationRail de 80, tarjetas en 2 columnas) · `expandida ≥ 1024` (rail extendido de 240, `DataTable` con paginación de 20, formularios centrados). Los destinos salen de los permisos del rol activo (`lib/core/navegacion/destinos.dart`):

| Rol (por permisos) | Compacto | Rail |
|---|---|---|
| Usuario | Inicio · Mis QR · Eventos · Perfil | + Emitir QR |
| Guardia (`puerta.supervisar`) | Inicio · Eventos · Puertas · Perfil | igual |
| Administrador (`usuario.ver`) | Inicio · Eventos · Admin · Perfil | Inicio · Emitir QR · Eventos · Puertas · Usuarios · Perfil |

## 3. Catálogo de componentes (`lib/shared/widgets/`)

| Nivel | Componente | Notas |
|---|---|---|
| Átomo | `AccesoBoton` (primaria, secundaria, texto, tonal, peligroTonal, peligroRelleno) | Estados normal, hover, foco, deshabilitado y carga (spinner 16 + gerundio) |
| Átomo | `AccesoBadge` | Siempre punto + texto. Vigente/Permitido/En línea = primario · Usado = informacion · Vencido = advertencia · Anulado = neutro · Rechazado/Sin conexión = peligro |
| Átomo | `AccesoCampoTexto`, `AccesoSelector`, `AccesoInterruptor` | Foco primario 2 dp, error peligro 2 dp con ícono, carga con spinner |
| Átomo | `AccesoAccionFila` | Ver = informacion · Editar = advertencia · Eliminar = peligro, con tooltip |
| Átomo | `AccesoTarjeta`, `AccesoAvatar`, `AccesoLogo`, `AccesoSkeleton`, `AccesoCargando` | Base de tarjeta con elev1; logo de AGROCOM (`assets/imagenes/logo_agrocom.png`) sobre placa blanca |
| Molécula | `CampoFormulario`, `TarjetaIndicador` (normal, hero, alerta), `EstadoVacio` (vacío, error, sin conexión), `ConfirmarDialogo` (con ficha "estado → estado"), `FilaClaveValor` (normal y navegable) | |
| Molécula | `AccesoAviso`, `SelectorSegmentado`, `TarjetaSeleccionable`, `IndicadorPasos`, `BannerSinConexion`, `TarjetaFila`, `ChipEtiqueta`, `CajaIcono` | |
| Organismo | `ListadoPaginado` (tarjetas con "Cargar más" < 1024 / `DataTable` ≥ 1024; estados carga, datos, vacío, error y sin conexión con caché + banner), `FormularioSecciones` (+ `BarraDeAcciones`), `VisorQr` | |
| Plantilla | `PlantillaAuth` (ancho 400; panel de marca a la izquierda en expandido), `PlantillaAdmin` (NavigationBar / rail / rail extendido según breakpoint y permisos), `PlantillaPantallaCompleta` (cerrar arriba, acción abajo) | |

## 4. Colores fijos de acción

**Ver = información · Editar = advertencia · Eliminar = peligro.** Toda otra acción es un cambio de estado y lleva el tono del estado al que lleva (el mismo de su badge y de su `ConfirmarDialogo`), definido una sola vez por entidad (`estado_qr_vista.dart`, `evento_vista.dart`).

## 5. El QR

`VisorQr`: módulos negros sobre blanco puro, 240 dp (320 en expandido) + 16 dp de silencio, corrección de errores M. La imagen compartida es un PNG de 1080×1350 con el QR, la etiqueta, las puertas y el vencimiento (`lib/core/qr/imagen_qr.dart`); en web, Web Share API o descarga. El token solo vive en la pantalla que lo muestra (ADR 0008).

## 6. Checklist de una pantalla nueva

- [ ] ¿Todo color, tamaño, radio y duración sale de un token?
- [ ] ¿Todo texto sale del ARB y está en tuteo?
- [ ] ¿Funciona en 360, 800 y 1440 de ancho, y en tema claro y oscuro?
- [ ] ¿Contraste AA de cada par nuevo, anotado en §2 y en `tema_test.dart`?
- [ ] ¿Los fakes tienen el shape real de la API?
- [ ] ¿Todo listado tiene carga (skeleton), vacío con acción, error con Reintentar y sin conexión?
- [ ] ¿Respeta `disableAnimations`?
