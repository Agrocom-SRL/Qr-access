# Guía de construcción de una pantalla — AGROCOM Acceso

**Origen:** `docs/diseno/guia_pantalla_panel.md` de ACRECIA (arquetipos y reglas de pantalla), traducida a Flutter. Tokens y componentes: `sistema-diseno.md`.

## 1. Dónde va cada archivo

| Qué | Dónde |
|---|---|
| Pantalla | `lib/features/<feature>/presentation/<nombre>_pantalla.dart` |
| Widgets propios de la feature | `lib/features/<feature>/presentation/widgets/` |
| Provider (estado) | `lib/features/<feature>/presentation/<nombre>_provider.dart` |
| Repositorio (API) | `lib/features/<feature>/data/<feature>_repositorio.dart` |
| Lógica pura | `lib/features/<feature>/domain/` |
| Ruta | `lib/core/router/rutas.dart` (con el permiso requerido) |
| Textos | `lib/l10n/app_es.arb` con prefijo de la feature |

Un componente que sirve a dos features sube a `lib/shared/widgets/`.

## 2. Arquetipos

### 2.1 Tablero
Cabecera → indicadores (`TarjetaIndicador`: accesos de hoy, rechazados, puertas sin latido) → últimos eventos. Para Administrador y Guardia.

### 2.2 Listado
Orden fijo: **cabecera** (título + botón "Nuevo" si hay permiso) → **barra** (buscador `q` + filtros) → **datos** (tabla en `expandido`, tarjetas clave-valor en `compacto`/`medio`) → **paginación**.
- Acciones de fila: Ver (información), Editar (advertencia), Eliminar (peligro); en tarjetas, menú "⋮" arriba a la derecha.
- `EstadoVacio` con dos variantes: "todavía no hay" (con la acción de crear) y "no hay resultados para este filtro" (con limpiar filtros).
- `activo` no se muestra como columna ni filtro en catálogos simples; los estados de dominio reales (invitación pendiente/usada/vencida) sí.

### 2.3 Formulario
- Secciones como tarjetas con título y cantidad de campos.
- **Tras guardar, se queda en edición** del mismo registro (con aviso de guardado), nunca vuelve al listado.
- **`activo` nunca va en el formulario**: un registro nace activo y se activa/desactiva con una acción aparte confirmada.
- Cancelar vuelve adonde vuelve "Volver".
- Salir a crear lo que falta (p. ej. un sitio desde el alta de puerta) no pierde lo cargado.
- Un formulario no esconde secciones por falta de un dato previo: las muestra deshabilitadas con la explicación.

### 2.4 Detalle
Cabecera con estado (badge) y acciones → secciones clave-valor → relacionados (p. ej. en una puerta: dispositivo, reglas y últimos eventos).

### 2.5 Emitir QR (usuario de cuenta)
Formulario corto: puerta(s), etiqueta opcional y vigencia (por defecto, fin del día; tope del plan) → `PlantillaPantalla` (formulario) con `VisorQr`, la puerta, la etiqueta y la hora de vencimiento → acción principal **Compartir** (menú de compartir del teléfono, imagen PNG con zona de silencio). El token no se vuelve a mostrar después de cerrar (ADR 0008).

### 2.6 Escáner (guardia)
Fuera de V1 (D-20).

## 3. Cambios de estado y confirmaciones

Toda baja o cambio de estado confirma con `ConfirmarDialogo`, con el color del estado destino y la ficha "estado actual → estado destino". Ninguna acción destructiva sin confirmación.

## 4. Checklist de cierre

- [ ] Arquetipo correcto y orden de secciones respetado.
- [ ] Tokens y textos del ARB (ver `sistema-diseno.md` §6).
- [ ] Permiso de la ruta y de cada acción (lo que el rol activo no puede, no se muestra).
- [ ] Estados de carga, vacío y error.
- [ ] Widget test con el fake del repositorio.
