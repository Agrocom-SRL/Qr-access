# Handoff: AGROCOM Acceso · Panel web de administración

## Resumen
Panel web para el equipo AGROCOM (super admin, tenant nulo). Desde aquí se crean y administran las cuentas cliente, las suscripciones anuales por cupo de usuarios (100 / 200 / 350), la cobranza manual, los planes, la bitácora de la plataforma y el equipo interno. Solo escritorio y tablet (≥ 768 px). La app móvil Flutter queda fuera de este paquete.

Cómo trabajar con este paquete: [`ARQUITECTURA_REACT.md`](ARQUITECTURA_REACT.md).
Para cualquier duda de negocio, API o modelo de datos, la fuente de verdad es:

```
/Users/miguel/Applications/AndroidStudio/Qr-access/docs
```

Si algo de este README choca con esos documentos, mandan los documentos. Anota la discrepancia en el PR.

## Sobre los archivos de diseño
Los `.dc.html` de `diseño/` son **referencias de diseño hechas en HTML**: muestran aspecto y comportamiento esperados, no son código para copiar. La tarea es **recrearlas en el frontend React** con la arquitectura descrita en `ARQUITECTURA_REACT.md`. Ábrelos en un navegador (necesitan `support.js` e `image-slot.js` en la misma carpeta).

## Fidelidad
**Alta fidelidad.** Colores, tipografía, espaciado, radios y textos son finales. Los precios en Bs son de ejemplo (se editan en Planes). Los datos de empresas son ficticios.

## Archivos
| Archivo | Contenido |
|---|---|
| `diseño/Panel Escritorio A.dc.html` | A01–A05d en claro + AD02 y AD05a en oscuro |
| `diseño/Panel Escritorio B.dc.html` | A06a–A12 |
| `diseño/Panel Estados.dc.html` | PE1a–PE5c: carga, vacío, error y sin conexión |
| `tokens/acceso-tokens.css` | Variables CSS claro/oscuro (`data-tema` en `<html>`) |
| `tokens/theme.ts` | Mismo set como objeto TS + mapas de badge y color de acción |
| `i18n/es.json` | Todos los textos de las pantallas, con claves por módulo |
| `capturas/escritorio/*.png` | A01–A12 a 1440×900, tema claro: **el aspecto aprobado** |
| `capturas/oscuro/*.png` | AD02 (Resumen) y AD05a (Detalle) en oscuro |
| `capturas/estados/*.png` | PE1a–PE5c: carga, vacío, error y sin conexión |
| `PROMPT_CLAUDE_CODE.md` | Prompt para arrancar en Claude Code |

Las capturas son la referencia visual definitiva: cada pantalla implementada se compara contra su PNG por id. El mismo criterio que con las capturas de la app Flutter.

## Pantallas (1440×900)
Layout común (`PlantillaAdmin`): rail de 240 a la izquierda (superficie, borde derecho 1 px), contenido con padding 32/48 y ancho máximo 1200. Encabezado de página: título 32/600, subtítulo 16/400 textoSecundario y la acción primaria a la derecha. En tablet (768–1023) el rail colapsa a 80 (solo íconos con tooltip) y las tablas ocultan columnas secundarias.

Rail: Resumen, Cuentas, Cobranza, Planes, Bitácora, Equipo AGROCOM. El ítem activo es una pastilla primarioSuave con ícono relleno, texto 600 y alto 48. Abajo va la tarjeta del usuario (avatar 40 con iniciales y "Super admin"), que lleva a Perfil.

| Id | Pantalla | Datos de API |
|---|---|---|
| A01 / A01b | Ingreso: normal, cargando, `AUTH_CREDENCIALES`, `AUTH_BLOQUEO_TEMPORAL` con cuenta regresiva | `POST auth/login` → token, perfil; error con `codigo` y `reintentarEn` |
| A02 · AD02 | Resumen: 4 TarjetaIndicador (la primera es hero), renovaciones próximas, últimas acciones | métricas agregadas; renovaciones ≤30 días y vencidas; últimas 5 entradas de bitácora |
| A03 | Cuentas: búsqueda, filtro segmentado con conteos, TablaDatos, BarraUso, paginación de 20 | lista paginada con `nombre, codigo, plan.cupo, usuariosActivos, venceEl, estado`; conteos por estado |
| A04a–e | Crear cuenta: Stepper de 4 pasos y PIN de una sola vez | validar código (`CUENTA_CODIGO_EXISTE` + sugerencias); planes; crear cuenta → PIN en claro **solo en esta respuesta** |
| A05a · AD05a | Detalle · Resumen: hero con plan, uso y vencimiento; FilaClaveValor de empresa; 3 indicadores | cuenta, empresa, conteo de sitios, puertas, dispositivos sin conexión y admins |
| A05b | Detalle · Suscripción: resumen, acciones Renovar / Cambiar plan / Suspender, historial | suscripción vigente; historial de periodos y pagos |
| A05c | Detalle · Sitios y puertas (solo lectura) con estado de cada dispositivo | sitios → puertas → dispositivo, `enLinea`, `ultimaSenal` |
| A05d | Detalle · Bitácora de la cuenta | bitácora filtrada por cuenta |
| A06a / A06b | Cambiar plan: comparación, diferencia, efecto; bajada bloqueada por cupo | `PLAN_CUPO_INSUFICIENTE` con `activos` y `cupo` |
| A07a / A07b | Renovar y registrar pago + ConfirmarDialogo | registrar pago `{monto, fecha, medio, referencia, comprobante?}` → nueva vigencia |
| A08 | Cobranza: 4 totales, filtro 30/60/90/vencidas, tabla, Registrar pago, Exportar CSV | totales; lista por ventana; CSV del servidor o generado en cliente |
| A09 | Planes: TarjetaPlan con precio editable; QR ilimitados fijo | planes con `cupo, precioAnual, cuentas, usuariosEnUso`; actualizar precio |
| A10 | Bitácora de la plataforma: filtros por cuenta, acción y fecha; paginada | `cuando, actor, cuentaCodigo, accion, antes, despues, origen` |
| A11 / A11b | Equipo AGROCOM: lista, desactivar y diálogo para agregar con contraseña temporal | super admins; crear; desactivar (nunca a sí mismo ni al último activo) |
| A12 | Perfil: datos, cambiar contraseña, tema (claro / oscuro / sistema), cerrar sesión | perfil; cambiar contraseña |

Las vistas a 768×1024 todavía no están diseñadas. Mientras tanto, aplica las reglas de tablet descritas arriba.

## Componentes (mismos nombres que la app)
`AccesoBoton`, `AccesoBadge`, `AccesoCampoTexto`, `AccesoSelector`, `AccesoInterruptor`, `CampoFormulario`, `TarjetaIndicador`, `EstadoVacio`, `ConfirmarDialogo`, `FilaClaveValor`, `ListadoPaginado`, `FormularioSecciones`, `PlantillaAuth`, `PlantillaAdmin`. Propios del panel: `TablaDatos`, `BarraUso`, `TarjetaPlan`, `BadgeSuscripcion`, `Stepper`. La clasificación atómica está en `ARQUITECTURA_REACT.md`.

Especificaciones clave:
- **AccesoBoton**: alto 48, radio completo, padding 0 24, texto 16/600. Variantes: `primario` (primario / sobrePrimario), `tonal` (primarioSuave / primario), `texto` (sin fondo, textoSecundario), `peligro` (borde 1 px peligro; hover peligroSuave). Deshabilitado: fondo borde, texto textoSecundario. Cargando: spinner 18 px y etiqueta en gerundio.
- **Botón de ícono**: 44×44, radio completo. Ver = informacion, Editar = advertencia, Eliminar/Suspender = peligro; en hover, fondo `*Suave`.
- **AccesoCampoTexto**: alto 48, radio 10, borde 1 px. Foco: borde 2 px primario. Error: borde 2 px peligro y mensaje 14/500 con ícono `error`. Deshabilitado: fondo `fondo`. Etiqueta 14/500 arriba (gap 8) y ayuda 12 textoSecundario abajo.
- **BadgeSuscripcion**: alto 24, radio completo, padding 0 8 0 6, ícono de 16 más texto 12/600 (ver `theme.ts › badgeSuscripcion`). Por vencer = ≤ 30 días.
- **BarraUso**: pista de 8 (12 en el hero) en primarioSuave con relleno primario; ≥ 90 % advertencia, ≥ 100 % peligro. Etiqueta mono "87 / 100".
- **Filtro segmentado**: contenedor con radio completo, borde 1 px y padding 4. Cada opción mide 40 de alto; la activa va en primario/sobrePrimario. Si corresponde, el conteo va en mono 12.
- **TablaDatos**: tarjeta con radio 20 y elevacion1. Encabezado en fondo `fondo`, 12/600 textoSecundario, padding 12 24. Filas de 56 de alto mínimo con borde superior de 1 px y hover `fondo`. Códigos, montos y fechas van en mono con `tabular-nums`. El badge va a la derecha y las acciones al final.
- **TarjetaIndicador**: radio 20, padding 24, etiqueta 16, cifra mono 32/600, detalle 14 y ícono en caja de 44, radio 14, fondo `*Suave`. La variante `hero` usa hero/sobreHero y el ícono sobre heroAcento.
- **Stepper**: círculos de 32 con borde 2. Activo y completado en primario; el completado lleva ícono `check`. Las líneas de 2 px se pintan en primario cuando el paso está completo.
- **ConfirmarDialogo / diálogos**: scrim, ancho 480 a 640, radio 20, padding 32, elevacion3. Las acciones van a la derecha (texto + primario). Se cierra con Esc y devuelve el foco al disparador.
- **EstadoVacio**: ilustración de 200×144 (unDraw recoloreado a `#007A33`), título 20/600, texto 14 de 400 px como máximo y AccesoBoton. Error: igual, más el código de la API en mono 12 y el botón tonal "Reintentar".

## Comportamiento
- **Errores de API**: llegan como `codigo`; un traductor central los convierte con `errores.*` de i18n. Si el código es desconocido, se muestra `errores.DESCONOCIDO` y el código en mono.
- **Estados por listado** (ver Panel Estados): skeleton con la forma real de las filas (pulso de opacidad de 1200 ms; estático con reducir movimiento), vacío con acción, error con reintento y sin conexión (banner advertencia, datos en caché y acciones de escritura desactivadas). Sin caché: pantalla completa PE5b. Un 401 lleva a PE5c.
- **Código de cuenta**: 3 letras A–Z, se guarda en mayúsculas y se valida contra la API con debounce de 300 ms. Es inmutable.
- **PIN inicial**: 7 caracteres (código + 4) en casillas 3 + 4, mono 32/600. Solo se muestra en la respuesta de creación; no se guarda en el estado global ni en logs, y al salir se descarta.
- **Vigencia**: vence = inicio + 12 meses. Renovar extiende 12 meses desde el vencimiento actual.
- **Bajar de plan**: se bloquea si `usuariosActivos > cupoNuevo`. El botón queda deshabilitado con un mensaje de peligro.
- **Precio de plan**: solo afecta renovaciones futuras; mostrar siempre el aviso informacion.
- **Bitácora**: toda mutación (crear, editar, cambiar plan, pagar, suspender, precio, equipo) genera una entrada con quién, cuándo, qué, antes, después y origen.
- **Formato**: montos `Bs 12.000` (separador de miles con punto, sin decimales), fechas `dd/mm/aaaa` y horas `HH:mm`, siempre con `Intl` según el idioma activo.
- **Movimiento**: 120 ms en hover, 200 ms en diálogos y pestañas, 300 ms en el stepper, todo con ease-out-cubic.
- **Accesibilidad**: AA como mínimo, foco visible (anillo de 2 px primario con offset 2), controles ≥ 44 y badges con texto.

## Tema
`data-tema` en `<html>`; la preferencia se guarda en localStorage y "Según el sistema" usa `prefers-color-scheme`. En oscuro no hay sombras: la elevación es superficie sobre fondo. Primario #5CB683 lleva texto verde900. El hero pasa a verde800.

## Recursos · reutilizar los de la app
El panel es de la misma familia que la app móvil, así que **los assets se copian del proyecto Flutter** (`/Users/miguel/Applications/AndroidStudio/Qr-access`, rutas declaradas en `pubspec.yaml` → `flutter.assets` y `fonts`) en lugar de crearse de nuevo:
- **Ilustraciones**: los SVG de unDraw ya recoloreados a `#007A33` que usa `EstadoVacio` en la app. Cópialos a `src/shared/ui/assets/ilustraciones/` con el mismo nombre. Si falta alguno de los que piden las capturas de estados (edificios, calendario, búsqueda, equipo, error de servidor, sin conexión, seguridad), descárgalo de unDraw con color `#007A33`.
- **Animaciones Lottie** (check de éxito, splash) si ya existen en la app: reutilízalas con `lottie-react` en "Cuenta creada" (A04e) y "Pago registrado". Respeta `prefers-reduced-motion`.
- **Logo**: el mismo de la app, en versión blanca sobre hero y en versión color sobre superficie. Hoy el diseño muestra un marcador rayado.
- **Fuentes**: IBM Plex Sans e IBM Plex Mono (400/500/600). Si la app las empaqueta, usa esos mismos archivos con `@font-face`; si no, usa Google Fonts.
- **Íconos**: **Material Symbols Outlined** (Material Design), los mismos que la app. En React: paquete `material-symbols` (fuente variable) o `@material-symbols/svg-400` (SVG por ícono, mejor para tree-shaking). Peso 400, `opsz` 24; relleno (`FILL 1`) solo en el ítem activo del rail. Usa los nombres de ícono que aparecen en los `.dc.html` (`space_dashboard`, `apartment`, `payments`, `sell`, `history`, `group`, `visibility`, `edit`, `autorenew`, `swap_vert`, `pause_circle`, `receipt_long`, `all_inclusive`, etc.).

## Pendientes de confirmar
- Si el cambio de plan a mitad de periodo cobra la diferencia ahora o en la renovación (el diseño solo muestra la diferencia anual).
- Vistas de 768×1024.
- Los códigos de error de este paquete son ejemplos: alinéalos con los de `docs/`.
