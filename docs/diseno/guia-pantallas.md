# Guía de construcción de una pantalla — AGROCOM Acceso

**Origen:** `guia_pantalla_panel.md` de ACRECIA, traducida a Flutter y ajustada al handoff V1 (`docs/diseno/handoff/README.md`, §Pantallas). Tokens y componentes: `sistema-diseno.md`.

## 1. Dónde va cada archivo

| Qué | Dónde |
|---|---|
| Pantalla | `lib/features/<feature>/presentation/<nombre>_pagina.dart` |
| Widgets propios de la feature | `lib/features/<feature>/presentation/widgets/` |
| Controlador (estado) | `lib/features/<feature>/presentation/<nombre>_controlador.dart` |
| Repositorio (API) | `lib/features/<feature>/data/<feature>_repositorio.dart` |
| Lógica pura | `lib/features/<feature>/domain/` |
| Ruta y permiso | `lib/core/router/rutas.dart` y `guarda_sesion.dart` |
| Destino de navegación | `lib/core/navegacion/destinos.dart` |
| Textos | `lib/l10n/app_es.arb` con prefijo de la feature |

Un componente que sirve a dos features sube a `lib/shared/widgets/`. Las features son `sesion`, `inicio`, `puertas` (solo datos), `qr_accesos`, `eventos`, `perfil` y `administracion`.

## 2. Pantallas del handoff y su implementación

| Id | Pantalla | Dónde |
|---|---|---|
| C01 · E01 | Bienvenida | `sesion/presentation/bienvenida_pagina.dart` (`PlantillaAuth`, hero verde) |
| C02–C02d · E02 | Ingreso con PIN | `sesion/presentation/ingreso_pagina.dart` + `widgets/casillas_pin.dart` (un `TextField` con overlay 3 + 4; bloqueo con cuenta regresiva) |
| C03 · E03 | Elegir rol | `sesion/presentation/elegir_rol_pagina.dart` (`TarjetaSeleccionable`, último rol preseleccionado) |
| C04a · E04a | Inicio de usuario | `inicio/presentation/widgets/inicio_usuario.dart` (hero, 4 accesos rápidos, vigentes hoy) |
| C04b · E04b | Tablero de administración | `inicio/presentation/widgets/inicio_admin.dart` (3 `TarjetaIndicador`, últimos eventos, refresco cada 30 s) |
| C05a–c · E05 | Emitir QR | `qr_accesos/presentation/emitir_qr_pagina.dart` (stepper; resumen fijo a la derecha en expandido) |
| C06 · E06 · S05 | QR emitido | `qr_accesos/presentation/mostrar_qr_pagina.dart` (`PlantillaPantallaCompleta`, confirmación al cerrar sin compartir) |
| C07 · C07b · E07 | Mis QR | `qr_accesos/presentation/mis_qr_pagina.dart` (pastillas con conteos, tabla en expandido, "Vigente → Anulado") |
| C08 · E08 | Eventos | `eventos/presentation/eventos_pagina.dart` (filtros por resultado y puerta, grupos por día, tabla con segundos) |
| C09 · E09 | Perfil | `perfil/presentation/perfil_pagina.dart` (cuenta, plan, rol activo, tema, cerrar sesión) |
| C10a · E10a | Puertas | `administracion/presentation/widgets/vista_puertas.dart` (En línea / Sin conexión, última señal) |
| C10b · E10b | Usuarios | `administracion/presentation/widgets/vista_usuarios.dart` + `usuario_formulario_pagina.dart` |
| C10c · E10b | PIN generado | `administracion/presentation/pin_generado_pagina.dart` (compacto) / diálogo (expandido) en `widgets/pin_generado_dialogo.dart` |

## 3. Arquetipos

### 3.1 Tablero
Cabecera (saludo + avatar, o título "Hoy" en expandido) → indicadores (`TarjetaIndicador`: accesos de hoy en hero, rechazados, puertas sin conexión con cifra en peligro si > 0) → últimos eventos (`FilaEvento`). Pull-to-refresh y refresco periódico. Lo ve quien supervisa puertas y ve todos los eventos; el resto ve el inicio de usuario.

### 3.2 Listado
Orden fijo: **título** (grande, en el contenido) con la acción principal a la derecha (botón en expandido, ícono en compacto, FAB en Mis QR) → **filtros** (`SelectorSegmentado`, `AccesoSelector`) → **`ListadoPaginado`** (tarjetas con encabezados de grupo y "Cargar más" en compacto y medio; `DataTable` con "1–20 de 148" en expandido) → nada más: la paginación va dentro.
- Los cuatro estados son obligatorios: carga (skeleton con la forma real), vacío (con la acción de crear o de quitar filtros), error ("No pudimos cargar…" + Reintentar) y sin conexión (lo último cargado + `BannerSinConexion`). `estadoDesdeAsync` los deriva del `AsyncValue` del provider.
- Acciones de fila: Ver (informacion), Editar (advertencia), Eliminar (peligro) con `AccesoAccionFila`; en tarjetas, la acción principal como texto ("Anular", "PIN").
- `activo` no se muestra como columna ni filtro; los estados de dominio reales (Vigente, Usado, Vencido, Anulado; En línea, Sin conexión) sí, siempre con `AccesoBadge`.

### 3.3 Formulario
`FormularioSecciones`: secciones como tarjetas con título en mayúsculas, ancho máximo 640 centrado en expandido, acciones fijas abajo en compacto (`BarraDeAcciones`).
- **Tras guardar, se queda en edición** del mismo registro con el aviso "Cambios guardados", nunca vuelve al listado. Al crear un usuario, pasa a la pantalla del PIN (que se ve una sola vez).
- **`activo` nunca va en el formulario**: un registro nace activo y se da de baja con una acción aparte confirmada.
- Cancelar vuelve al listado.

### 3.4 Stepper (Emitir QR)
`IndicadorPasos` + un contenido por paso + `BarraDeAcciones` (Atrás · Siguiente / Emitir QR). Cada paso valida lo suyo antes de avanzar; el error de la API se muestra en el paso 3 con Reintentar. En expandido, `ResumenEmision` fijo a la derecha con el botón del paso.

### 3.5 Pantalla completa
`PlantillaPantallaCompleta` para lo que se ve una sola vez (QR emitido, PIN generado): cerrar arriba a la izquierda, acción principal abajo, aviso en `AccesoAviso` de advertencia. Cerrar sin compartir el QR pide confirmación.

### 3.6 Escáner (guardia)
Fuera de V1 (D-20).

## 4. Cambios de estado y confirmaciones

Toda baja o cambio de estado confirma con `ConfirmarDialogo`, con el color del estado destino y la ficha "estado actual → estado destino" (`TransicionDeEstado`). Regenerar un PIN también confirma: invalida el anterior y cierra las sesiones. Ninguna acción destructiva sin confirmación.

## 5. Checklist de cierre

- [ ] Arquetipo correcto y orden de secciones respetado; comparado con la captura del mismo id en `docs/diseno/handoff/capturas/`.
- [ ] Tokens y textos del ARB (ver `sistema-diseno.md` §6).
- [ ] Permiso de la ruta (`guarda_sesion.dart`) y de cada acción (lo que el rol activo no puede, no se muestra).
- [ ] Estados de carga, vacío, error y sin conexión.
- [ ] Widget test con el fake del repositorio, en compacto y, si tiene tabla, en expandido (`montarPantalla(expandida: true)`).
