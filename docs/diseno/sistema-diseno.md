# Sistema de diseño — AGROCOM Acceso (Flutter)

**Origen:** principios de `docs/diseno/diseno-laravel.md` y `sistema_diseno_panel.md` de ACRECIA (tokens al origen, Atomic Design, marca en un solo archivo, motion motivado), traducidos a Flutter. ADR 0012.

## 1. Principios (no negociables)

1. **Tokens al origen.** Ningún color, tamaño, radio, sombra o duración se escribe suelto en un widget. Todo sale de `Theme.of(context)` y de `AccesoTokens`.
2. **Tres capas**: primitivos (`lib/core/theme/primitivos.dart`, único lugar con hex) → semánticos por tema (claro/oscuro) → componentes. Un widget solo lee semánticos.
3. **Marca en un solo archivo.** Cambiar la marca (o, más adelante, la marca por cuenta) es editar `primitivos.dart`.
4. **Atomic Design**: átomos → moléculas → organismos → plantillas → pantallas.
5. **Mock con el shape real**: los fakes de los tests y de desarrollo devuelven exactamente lo que devuelve la API.
6. **Motion motivado** y respetando `MediaQuery.disableAnimations`.
7. **Una sola escala de breakpoints** (§2.6).
8. **El QR no se tematiza**: negro sobre blanco siempre.

## 2. Tokens

### 2.1 Color de marca — verde de la bandera de Santa Cruz

La marca predomina en el **verde de la bandera de Santa Cruz** (verde · blanco · verde). Base: **`#007A33`** (Pantone 356 C, referencia habitual del verde cruceño). **Pendiente**: confirmar el hex con el manual de marca de AGROCOM o de la Gobernación (duda D-08); si cambia, se recalcula la rampa y la tabla de contraste.

| Token primitivo | Hex | Contraste con blanco | Contraste con fondo oscuro `#121614` |
|---|---|---|---|
| `verde50` | `#E8F5EE` | 1.12 | 16.28 |
| `verde100` | `#C5E6D2` | 1.34 | 13.58 |
| `verde200` | `#93D0AB` | 1.77 | 10.30 |
| `verde300` | `#5CB683` | 2.48 | 7.36 |
| `verde400` | `#2B9A5D` | 3.57 | 5.11 |
| **`verde500`** (bandera) | **`#007A33`** | **5.48** | 3.33 |
| `verde600` | `#006B2D` | 6.69 | 2.73 |
| `verde700` | `#005824` | 8.67 | 2.10 |
| `verde800` | `#00451C` | 11.24 | 1.62 |
| `verde900` | `#002F13` | 14.83 | 1.23 |

El **blanco** es el segundo color de marca: superficies limpias, texto sobre el verde (5.48:1, AA).

### 2.2 Neutros y estados

| Primitivo | Hex | Uso |
|---|---|---|
| `neutro0` | `#FFFFFF` | Superficie clara |
| `neutro50` | `#F5F7F6` | Fondo claro |
| `neutro200` | `#DDE2DF` | Bordes claros |
| `neutro600` | `#5B635D` | Texto secundario claro (6.20:1 sobre blanco) |
| `neutro900` | `#1B1F1C` | Texto principal claro (16.68:1) |
| `neutroOscuro50` | `#121614` | Fondo oscuro |
| `neutroOscuro100` | `#1C211E` | Superficie oscura |
| `neutroOscuro300` | `#A3ABA5` | Texto secundario oscuro (7.76:1) |
| `neutroOscuro400` | `#E6EAE7` | Texto principal oscuro (15.03:1) |
| `rojo600` / `rojo300` | `#C62828` / `#EF7A7A` | Peligro claro (5.62) / oscuro (6.72) |
| `ambar700` / `ambar300` | `#965A00` / `#F2B54A` | Advertencia claro (5.59) / oscuro (9.98) |
| `azul700` / `azul300` | `#1565C0` / `#7EB6F2` | Información claro (5.75) / oscuro (8.57) |

### 2.3 Semánticos (lo único que leen los widgets)

| Semántico | Tema claro | Tema oscuro |
|---|---|---|
| `fondo` | `neutro50` | `neutroOscuro50` |
| `superficie` | `neutro0` | `neutroOscuro100` |
| `texto` | `neutro900` | `neutroOscuro400` |
| `textoSecundario` | `neutro600` | `neutroOscuro300` |
| `borde` | `neutro200` | `#2C332E` |
| `primario` (acción principal, marca) | `verde500` | `verde300` (6.59 sobre superficie oscura) |
| `sobrePrimario` | `neutro0` | `neutroOscuro50` |
| `primarioSuave` (fondos de chip, selección) | `verde50` | `verde900` |
| `exito` | `verde600` | `verde300` |
| `advertencia` | `ambar700` | `ambar300` |
| `peligro` | `rojo600` | `rojo300` |
| `informacion` | `azul700` | `azul300` |
| `accesoPermitido` | `verde500` | `verde300` |
| `accesoDenegado` | `rojo600` | `rojo300` |

`ColorScheme` de Material 3 se arma desde estos semánticos (no con `fromSeed`, que generaría tonos que no son los de la marca).

### 2.4 Tipografía

**IBM Plex Sans** (texto) e **IBM Plex Mono** (cifras alineadas, códigos, ids), las mismas de ACRECIA, empaquetadas en la app (sin depender de Google Fonts en tiempo de ejecución). Escala: 12 · 14 · 16 (cuerpo) · 20 · 24 · 32. Peso 400/500/600.

### 2.5 Espaciado, radios, elevación y movimiento

| Grupo | Tokens |
|---|---|
| Espaciado (base 4) | `xxs 2 · xs 4 · s 8 · m 12 · l 16 · xl 24 · xxl 32 · xxxl 48` |
| Radios | `s 6 · m 10 · l 14 · xl 20 · completo 999` |
| Elevación | `0 · 1 · 3` (en oscuro, la elevación se marca con superficie más clara, no con sombra) |
| Duraciones | `rapida 120ms · normal 200ms · lenta 300ms`; curva `Curves.easeOutCubic` |
| Controles | alto mínimo 44 dp (táctil), 40 dp en web densa |

### 2.6 Breakpoints

`compacto < 600` (móvil: drawer, listados como tarjetas) · `medio 600–1023` (tablet: rail) · `expandido ≥ 1024` (web: rail extendido, tablas). Ningún otro número.

## 3. Componentes base (catálogo inicial)

| Nivel | Componente | Notas |
|---|---|---|
| Átomo | `AccesoBoton` (primario, secundario, texto, peligro) | Tonos de acción fijos (§4) |
| Átomo | `AccesoBadge` | Tono por estado, mapa único por entidad |
| Átomo | `AccesoCampoTexto`, `AccesoSelector`, `AccesoInterruptor` | Label siempre visible, error debajo |
| Molécula | `CampoFormulario`, `TarjetaIndicador`, `EstadoVacio`, `ConfirmarDialogo`, `FilaClaveValor` | |
| Organismo | `ListadoPaginado` (tabla ≥ 1024, tarjetas < 1024), `FormularioSecciones`, `VisorQr`, `EscanerQr`, `ResultadoAcceso` | |
| Plantilla | `PlantillaAdmin`, `PlantillaAuth`, `PlantillaPantallaCompleta` | |

Cada componente: widget test y entrada en esta tabla.

## 4. Colores fijos de acción (de ACRECIA)

**Ver = información · Editar = advertencia · Eliminar = peligro.** Toda otra acción es un cambio de estado y lleva el tono del estado al que lleva (el mismo de su badge y de su `ConfirmarDialogo`), definido una sola vez por entidad.

## 5. El QR y el resultado de acceso

- `VisorQr`: módulos negros sobre blanco puro, mínimo 240 dp, zona de silencio de 4 módulos, corrección de errores M. Brillo al máximo mientras está visible. Cuenta regresiva del paso de 30 s con una barra en `primario`.
- `ResultadoAcceso`: pantalla completa en `accesoPermitido` / `accesoDenegado` con ícono grande, nombre y motivo traducido; se cierra sola a los 3 s. Además del color, ícono y texto (nunca solo color).

## 6. Checklist de una pantalla nueva

- [ ] ¿Todo color, tamaño, radio y duración sale de un token?
- [ ] ¿Todo texto sale del ARB y está en tuteo?
- [ ] ¿Funciona en los tres breakpoints y en tema claro y oscuro?
- [ ] ¿Contraste AA de cada par nuevo, anotado en §2?
- [ ] ¿Los fakes tienen el shape real de la API?
- [ ] ¿Respeta `disableAnimations`?
