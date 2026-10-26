# Pantallas de la jerarquía de usuarios — AGROCOM Acceso

**Alcance:** las pantallas que introdujo el ADR 0028 (Administrador → Titular y Guardia → Miembro), en la app Flutter y en el panel web. Este documento describe **lo que ya está implementado** (leído del código); lo que sea mejora aún no construida va marcado como **Propuesta**. Las capturas y los ids del diseñador siguen en `docs/diseno/handoff/` (no se toca desde aquí).

**Fuentes:** `docs/decisiones/0028-jerarquia-de-usuarios.md`, `docs/gestion/jerarquia-de-usuarios.md`, `docs/diseno/guia-pantallas.md`, `docs/diseno/sistema-diseno.md`.

## 0. Reglas comunes

- **Tokens, nunca literales (invariante 12).** En la app: `context.tokens` (`colores`, `espacio`, `radio`, `tamano`, `tipografia`, `duracion`). En la web: variables CSS del tema (`--superficie`, `--borde`, `--textoSecundario`, `--esp8/16/24`, `--radio20`, `--elevacion1`, `--texto14/16/20`, `--peso600`). Abajo se nombran por token.
- **Textos solo de `app/lib/l10n/app_es.arb` y `web/src/l10n/es/*.json`**, en tuteo. Los nombres visibles de los niveles son **Administrador, Titular, Miembro y Guardia**; "sitio" se rotula **Propiedad** y "casa/departamento", **Unidad**.
- **Lo que el rol no puede, no se muestra** (ADR 0004): cada bloque se condiciona por permiso (`Permisos.*` en la app, `tienePermiso` en la web), nunca por el nombre del rol. La autoridad es siempre la API (403/404); la UI solo evita ofrecer lo que fallaría.
- **Estados mínimos** de todo bloque con datos: cargando (skeleton o `AccesoCargando`), vacío (con explicación y, si hay permiso, acción), error con "Reintentar" y sin permiso (el bloque no se dibuja).
- **Movimiento:** solo el de los componentes existentes, que ya respetan `MediaQuery.disableAnimations` (`tokens.duracion.efectiva`). Estas pantallas no agregan animaciones propias.
- **Breakpoints (app):** compacto 360×800 (< 600), medio (600–1023), expandido 1440×900 (≥ 1024). En compacto la navegación es la `NavigationBar`; en expandido, el rail extendido.

---

## Parte A. App (Flutter)

### A1. Selector de rol por nivel al crear un usuario

- **Propósito:** que quien crea elija solo el nivel que le corresponde (ADR 0028 §3). Administrador: Titular o Guardia. Titular: solo Miembro. Miembro y Guardia no crean.
- **Archivos:** `features/administracion/presentation/widgets/selector_de_rol.dart` (`SelectorDeRol`), `domain/nivel_usuario.dart` (`puedeCrearNivel`), formulario en `usuario_formulario_pagina.dart`.
- **Estructura:** sección "Rol" (`usuariosSeccionRoles`) dentro de `FormularioSecciones`, tras "Datos del usuario". Lista vertical de `RadioListTile` con nombre del rol y una línea de descripción (`usuariosRolDescripcionTitular/Guardia/Miembro`). Si se intentó guardar sin elegir, texto de error en `colores.peligro` (`usuariosErrorSinRoles`). Los roles se filtran con `puedeCrearNivel(nivelDelActor, nivelDelRol)`; el nivel sale del nombre del rol.
  - **Compacto:** formulario a una columna, acciones al pie (Cancelar / Generar PIN).
  - **Expandido:** el formulario queda centrado en `tamano.maxFormularioSecciones`; el resto igual.
- **Componentes existentes:** `FormularioSecciones`/`SeccionDeFormulario`, `CampoFormulario`, `AccesoAviso`, `AccesoCargando`, `ChipEtiqueta` (al editar, el rol se muestra como chip y no se cambia), `AccesoBoton`, `PlantillaAdmin`.
- **Tokens:** `espacio.s` (separación del error), `colores.peligro`, estilos `bodyMedium` del tema.
- **Estados:** cargando roles → `AccesoCargando`; error → `AccesoAviso` peligro con `textoDeError`; vacío (nadie asignable) → `AccesoAviso` informativo `usuariosSinRolesParaCrear` ("Con tu rol no puedes crear usuarios."); sin permiso → la ruta de alta depende de `crearUsuarios` y el botón "Nuevo usuario" solo aparece con él.
- **Accesibilidad:** `RadioGroup` + `RadioListTile` dan semántica de grupo de opciones y área táctil de fila completa. El error es texto visible (no solo color).
- **Propuesta:** para el Titular (una sola opción) no mostrar el selector y fijar Miembro, como pide el ADR 0028 §3 (hoy se ve un único radio sin preseleccionar; ver inconsistencias).

### A2. Sección Unidad (Titular nuevo)

- **Propósito:** un Titular responde por una unidad; la unidad nace con él (propiedad + nombre).
- **Archivos:** `widgets/seccion_unidad.dart` (`SeccionUnidad`); se muestra en el formulario solo si el rol elegido es Titular y el usuario es nuevo. Al editar, la unidad existente se ve como `ChipEtiqueta` de solo lectura.
- **Estructura:** sección "Unidad" (`usuariosSeccionUnidad`) con dos campos: selector de Propiedad (`usuariosCampoPropiedad`, ícono `apartment_outlined`, placeholder `usuariosCampoPropiedadPlaceholder`) y campo de texto "Nombre de la unidad" (`usuariosCampoUnidad`, ayuda `usuariosCampoUnidadAyuda`, ejemplo `usuariosCampoUnidadEjemplo`, tope `DatosUnidad.largoMaximoNombre`).
  - **Compacto y expandido:** misma columna del formulario (no hay disposición propia por ancho).
- **Componentes existentes:** `CampoFormulario`, `AccesoSelector`, `AccesoCampoTexto`, `AccesoAviso`, `AccesoCargando`.
- **Tokens:** los de los átomos (foco primario, error peligro); ninguno propio.
- **Estados:** cargando propiedades → `AccesoCargando`; error → `AccesoAviso` peligro; vacío (la cuenta no tiene propiedades) → `AccesoAviso` informativo `usuariosSinPropiedades` (indica crearlas en Administración › Propiedades y puertas); errores de campo `usuariosErrorSinPropiedad`, `usuariosErrorSinNombreUnidad`, `usuariosErrorUnidadLarga`; sin permiso → la sección no existe si el rol elegido no es Titular.
- **Accesibilidad:** cada campo con etiqueta visible y error textual con ícono (átomos de campo); contador de caracteres por `CampoFormulario`.
- **Propuesta:** cuando no hay propiedades, ofrecer un botón que lleve a la pestaña de Propiedades en lugar de solo el texto.

### A3. Tarjeta de cupo y tope de Miembros

- **Propósito:** que el Administrador vea cuánto del plan consume la cuenta (usados / habilitados) y el tope de Miembros por Titular, con avisos al 80 % y al 100 % (ADR 0028 §6). Total de la cuenta, aunque gestione solo su rama.
- **Archivos:** `widgets/banner_cupo.dart` (`BannerCupo`), arriba del listado en `vista_usuarios.dart`. Se dibuja solo con `Permisos.verCupo`.
- **Estructura:** `AccesoTarjeta` con: título "Cupo de usuarios" (`cupoTitulo`, `titleMedium`), línea "{usados} de {maximo} usuarios" (`cupoUsados`) o "{usados} usuarios · sin límite" (`cupoSinLimite`), barra de progreso, aviso opcional y pie "Cada Titular puede tener hasta {maximo} Miembros." (`cupoMaximoMiembros`, `bodySmall`).
  - **Compacto:** la tarjeta va sobre la banda de foto y el listado en tarjetas.
  - **Medio y expandido:** la tarjeta va sobre la tabla; sin banda de foto. Mismo ancho que el contenido.
- **Componentes existentes:** `AccesoTarjeta`, `AccesoAviso`, `LinearProgressIndicator` de Material (con `ClipRRect`).
- **Tokens:** `espacio.l/m/s`, `radio.s`, `tamano.barraUso`, `colores.primario` (normal), `colores.advertencia` (cerca del límite, `cupoAvisoCerca`), `colores.peligro` (límite alcanzado, `cupoAvisoLimite`), `colores.borde` (pista de la barra), `colores.textoSecundario`.
- **Estados:** sin dato (cargando o error de lectura) → el bloque no se dibuja (decisión del código: no es información de la que dependa otra cosa); sin límite → sin barra; cerca/límite → `AccesoAviso` advertencia/peligro; sin permiso → no se dibuja (Titular, Guardia y Miembro nunca lo ven).
- **Accesibilidad:** el estado no depende solo del color de la barra: el aviso textual lo repite. La barra no tiene etiqueta semántica propia.
- **Propuesta:** dar a la barra una etiqueta semántica con "{usados} de {maximo}" y mostrar un error discreto con Reintentar si el cupo falla al cargar.

### A4. Estadísticas de uso de los usuarios

- **Propósito:** decidir a quién dar de baja (ADR 0028 §4): inactivos (30 días sin generar QR), ruidosos (más de 10 QR en un día) y Titulares cerca de su tope (80 %). Informativo; no hay bloqueo, solo baja.
- **Archivos:** entrada `widgets/tarjeta_estadisticas.dart` (`TarjetaEstadisticas`, con `Permisos.verEstadisticas`) y pantalla `estadisticas_usuarios_pagina.dart` (ruta `Rutas.adminEstadisticas`, `/admin/usuarios/estadisticas`).
- **Estructura de la entrada:** `AccesoTarjeta` tocable: título "Uso de los usuarios" (`estadisticasTitulo`), resumen "{n} inactivos · {n} ruidosos · {n} Titulares cerca del tope" (`estadisticasResumen`) y chevron (`tamano.iconoNav`).
- **Estructura de la pantalla:** `PlantillaAdmin` con atrás hacia la lista; `ListView` con `AccesoAviso` informativo de los umbrales (`estadisticasAviso`), `SelectorSegmentado` de tres segmentos con conteo (Inactivos / Ruidosos / Titulares) y la lista del segmento. Cada fila es una `TarjetaFila` con `AccesoAvatar` neutro, `ChipEtiqueta` de rol y unidad, y una línea de detalle (`estadisticasDetalleInactivo`, `...NuncaGeneroQr`, `...Ruidoso`, `estadisticasTitularDetalle`). Inactivos y ruidosos llevan al pie el botón "Eliminar" (`AccesoBoton` texto, ícono `person_remove_outlined`) que abre el flujo de A5.
  - **Compacto:** una columna de tarjetas, `padding espacio.l`.
  - **Expandido:** el mismo `ListView` dentro de la plantilla con rail; no hay tabla propia (ver Propuesta).
- **Componentes existentes:** `PlantillaAdmin`, `AccesoAviso`, `SelectorSegmentado`, `TarjetaFila`, `AccesoAvatar`, `ChipEtiqueta`, `AccesoBoton`, `EstadoVacio`, `AccesoCargando`.
- **Tokens:** `espacio.l/m/s/xs`, `colores.textoSecundario`; el tono "baja" lo pone `AccesoBoton`/`ConfirmarDialogo` (peligro, color fijo de Eliminar).
- **Estados:** cargando → `AccesoCargando`; error sin datos previos → `EstadoVacio.error` con Reintentar (si ya hubo datos, se conservan mientras Riverpod reintenta); vacío por segmento → `EstadoVacio` con ícono de visto (`estadisticasSinInactivos`, `...SinRuidosos`, `...SinTitulares`); sin permiso de ver → la entrada no existe; sin permiso de eliminar → la fila no lleva botón. El botón se deshabilita mientras otra baja está en curso y muestra carga en la fila afectada.
- **Accesibilidad:** el segmentado muestra el conteo como texto; el botón de baja es textual (no solo ícono). Los Titulares cerca del tope no tienen acción (solo informan).
- **Propuesta:** en expandido, usar `ListadoPaginado` con `DataTable` (consistente con Usuarios); y dar a los Titulares cerca del tope un enlace a su ficha.

### A5. Diálogo de baja en cascada con conteo de Miembros

- **Propósito:** dar de baja a un usuario; si es un Titular con Miembros, decir cuántos caerían con él antes de confirmar (ADR 0028 §7). Libera sus lugares del cupo.
- **Archivos:** `widgets/baja_de_usuario.dart` (`pedirBajaDeUsuario`), usado por `vista_usuarios.dart` y `estadisticas_usuarios_pagina.dart`.
- **Estructura (dos pasos):** (1) `ConfirmarDialogo` con título "¿Dar de baja a {nombre}?" (`usuariosEliminarTitulo`) y mensaje `usuariosEliminarMensaje`; confirma con "Eliminar" (`comunEliminar`, `VarianteBoton.peligroRelleno`). (2) Si la API responde 409 `usuario.con_dependientes` con `dependientes`, un segundo `ConfirmarDialogo` con `usuariosEliminarCascadaMensaje(cantidad)` (plural: "También se dará de baja a N usuarios a su cargo, junto con su unidad… No se puede deshacer."). Al confirmar se repite la baja con `confirmar: true`. Cualquier otro error sale en `SnackBar` con `textoDeError`.
  - **Compacto y expandido:** diálogo modal centrado; no cambia con el ancho.
- **Componentes existentes:** `ConfirmarDialogo` (molécula), `AccesoAccionFila` (Eliminar en la tabla), `AccesoBoton`.
- **Tokens:** `radio.xl` y `superficieElevada` del diálogo; el ícono y el botón en tono peligro (`TonoCaja.peligro`, `VarianteBoton.peligroRelleno`).
- **Estados:** en curso → botón con carga y los demás deshabilitados (`accionesUsuarioProvider`); error → `SnackBar`; sin permiso → el botón Eliminar no se dibuja (`Permisos.eliminarUsuarios`), y nunca aparece para uno mismo (`usuario.id != propioId`); cancelar en cualquier paso no cambia nada.
- **Accesibilidad:** diálogo con título y botones etiquetados; el conteo va en el texto (plural correcto), no en un badge. Cancelar es la salida por defecto (cerrar = cancelar).
- **Propuesta:** el segundo diálogo podría mostrar la ficha "estado → estado" (`TransicionDeEstado`: Habilitado → Baja) y el ícono, como el resto de bajas de la guía §4; hoy solo usa texto.

### A6. Compartir el PIN (pantalla completa C10c / diálogo E10b)

- **Propósito:** mostrar el PIN una sola vez al crear o regenerar, y entregarlo con la hoja de compartir del sistema, dejando constancia en la bitácora (ADR 0028 §7, ADR 0018).
- **Archivos:** `widgets/pin_generado_dialogo.dart` (`mostrarPinGenerado`, `ContenidoPinGenerado`) y `pin_generado_pagina.dart`. "Compartir" es la única salida: no hay "Copiar".
- **Estructura:** PIN en mono 32 (`tipografia.t32`, `semiNegrita`, `espaciadoPin`) con el código de cuenta atenuado; botón tonal "Compartir" (`usuariosPinCompartir`, ícono `ios_share`); dos `AccesoAviso`: "Solo lo verás ahora…" (`usuariosPinAvisoNuevo` / `usuariosPinAvisoRegenerado`) y "Al compartirlo, el PIN pasa por una aplicación de terceros… queda registrado" (`usuariosPinAvisoCompartir`). Cierra con "Listo, ya lo entregué" (`usuariosPinListo`).
  - **Compacto:** pantalla completa (`PlantillaPantallaCompleta`, cerrar arriba y botón al pie), foto de cabecera (`cabeceraFoto / 2`), encabezado "Para / nombre / rol", PIN y botón en columna.
  - **Expandido:** `AlertDialog` no descartable tocando fuera, ancho `tamano.maxFormularioSecciones`; PIN y botón Compartir en la misma fila sobre `colores.fondo`.
- **Componentes existentes:** `PlantillaPantallaCompleta`, `AccesoTarjeta`, `AccesoBoton`, `AccesoAviso`, `AccesoFoto`.
- **Tokens:** `espacio.xl/l/m`, `radio.xl`, `colores.texto/textoSecundario/fondo`, `tipografia.mono`.
- **Estados:** compartiendo → botón en carga; si el dispositivo no puede abrir la hoja, el mensaje se copia y sale un `SnackBar` (`usuariosPinCopiadoParaCompartir`); si falla el registro en la bitácora no se bloquea nada (el envío ya ocurrió); sin permiso → quien no puede regenerar/crear no llega aquí. Al cerrar, el PIN no se puede volver a ver.
- **Accesibilidad:** el PIN lleva `semanticsLabel` (`usuariosPinSemantica`, "PIN …") para que el lector no lo deletree como cifra grande; el botón es textual. El texto compartido es `usuariosPinMensajeCompartir`.
- **Propuesta:** anunciar con una región `liveRegion` el resultado de compartir (copiado/compartido) para lectores de pantalla.

### A7. QR propio en la cabecera del inicio y botón flotante "Generar QR"

- **Propósito:** separar dos intenciones: usar **mi** QR (cabecera, un toque) y **generar y compartir** un QR para otra persona (botón flotante). Ver ADR 0028 §5.
- **Archivos:** `features/inicio/presentation/inicio_pagina.dart` (FAB), `widgets/encabezado_inicio.dart` (cabecera con `accion`), `widgets/boton_qr_propio.dart` (`BotonQrPropio`), `inicio_usuario.dart` e `inicio_admin.dart` (pasan `BotonQrPropio` a la cabecera si hay `Permisos.generarQrPropio`).
- **Estructura:** cabecera "Hola, {nombre}" + "{cuenta} · {rol}" (avatar y saludo llevan al perfil) y, a la derecha, `IconButton.filledTonal` con ícono `how_to_reg` (tooltip `inicioQrPropio`, "QR propio"; navega a `Rutas.qrRapido`). Botón flotante `FloatingActionButton` sin texto, ícono `qr_code_2`, tooltip `qrGenerarBoton` ("Generar QR"), navega a `Rutas.qrNuevo`; solo con `Permisos.generarQr`. El contenido deja `tamano.fab + espacio.xl` libres abajo para que el botón no tape nada.
  - **Compacto:** cabecera en una fila; FAB sobre la `NavigationBar` (lo ubica `PlantillaAdmin`).
  - **Expandido:** el rail extendido añade el destino "Generar QR" (con `generarQr`); el FAB y el botón de la cabecera se mantienen.
- **Componentes existentes:** `PlantillaAdmin` (parámetro `fab`), `AccesoAvatar`, `HeroConFoto`, `CajaIcono`, accesos rápidos.
- **Tokens:** `espacio.m/xl`, `radio.l`, `tamano.fab` (56), `colores.textoSecundario`; los colores del botón y del FAB los pone el tema de Material (primario).
- **Estados:** sin `generarQrPropio` → la cabecera no lleva botón; sin `generarQr` → no hay FAB ni hero "Generar QR" (el **Guardia**); cargando/error de las listas de abajo, ver A8. El QR en sí se muestra siempre negro sobre blanco con zona de silencio (sistema de diseño §5).
- **Accesibilidad:** ambos botones tienen tooltip, que sirve de etiqueta para lectores de pantalla; el IconButton cumple el mínimo táctil (48 ≥ `tamano.minimoTactil`). El saludo es un `Semantics(button, label: navPerfil)`.
- **Propuesta:** unificar el ícono del QR propio: la cabecera usa `how_to_reg` y el acceso rápido de abajo usa `person_pin_outlined` para lo mismo.

### A8. Inicio del Guardia (sin "Generar QR" de visitas)

- **Propósito:** el Guardia solo usa su QR propio y vigila; no genera ni comparte QR de visitas, ni ve cupo ni estadísticas (ADR 0028 §5).
- **Archivos:** `inicio_usuario.dart` (rama `guardia`), `core/navegacion/destinos.dart` (`esGuardia`, `destinosPara`), `widgets/hero_accesos_de_hoy.dart`.
- **Estructura:** cabecera con el botón de QR propio; en lugar del hero "Generar QR", `HeroAccesosDeHoy` (permitidos y rechazados de hoy, toca para ir a Eventos); accesos rápidos solo con lo permitido (QR propio, Eventos); "Últimos eventos" con "Ver todos". Sin FAB. Navegación compacta: Inicio · Eventos · Puertas · Perfil.
  - **Compacto:** una columna, `RefreshIndicator`.
  - **Expandido:** el rail del Guardia no incluye "Generar QR" ni "Usuarios".
- **Componentes existentes:** `HeroAccesosDeHoy`, `FilaEvento`, `AccesoTarjeta`, `AccesoSkeleton`, `EstadoVacio` (`.error`, `.sinConexion`), `CajaIcono`.
- **Tokens:** `colores.sobreHero`, `espacio.*`, `tamano.accesoRapido`, `opacidadDeshabilitado` para accesos apagados.
- **Estados:** eventos cargando → dos esqueletos; error de red → `EstadoVacio.sinConexion`; otro error → `EstadoVacio.error` con Reintentar; vacío → `EstadoVacio` con ilustración (`eventosSinResultados`); sin permiso → los bloques de QR y de usuarios simplemente no existen. Sin `verQr` ni siquiera se pide la lista de QR.
- **Accesibilidad:** los accesos rápidos son `Semantics(button, enabled, label)`; el apagado conserva su lugar para que no se muevan.

---

## Parte B. Panel web (React)

Todas viven en la ficha de la cuenta, pestaña **Resumen** (`features/cuentas/ui/components/ResumenDeCuenta.tsx`), en este orden: Administradores → Quién depende de quién → Uso de los usuarios. Solo super admin (AGROCOM). Cada una es una `<section>` con `aria-labelledby` y encabezado `h2`.

Tokens de las tres tarjetas (`*.module.css`): fondo `--superficie`, radio `--radio20`, sombra `--elevacion1`, relleno `--esp24`, separación `--esp16`, título `--texto20`/`--peso600`, texto de apoyo `--textoSecundario` con `--texto14`, separadores `--borde`.

### B1. "Quién depende de quién" (árbol de la cuenta)

- **Propósito:** ver cómo está armada la cuenta: cada Administrador con sus Titulares (unidad y número de Miembros) y sus Guardias; punto de entrada de la reasignación.
- **Archivo:** `JerarquiaDeCuenta.tsx` (título `detalle:jerarquiaTitulo`).
- **Estructura:** lista de ramas; cada rama es un `h3` con el Administrador y, debajo, una lista con sangría y línea izquierda de `--borde` (`border-left`). Cada fila: nombre en negrita y detalle "Titular · {unidad} · {n} Miembros" (`titularDetalle`, plural) o "Guardia" (`guardiaDetalle`); con el permiso, botón tonal "Reasignar" (ícono `swap_vert`). Los Miembros se cuentan, no se listan.
  - **1440×900:** la tarjeta ocupa el ancho de la columna del Resumen; filas en una línea.
  - **Angosto:** las filas son flex con `min-width: 0`, así que el texto se trunca/envuelve y el botón queda a la derecha. (La web de AGROCOM es de escritorio; no hay vista de 360.)
- **Componentes existentes:** `AccesoBoton` (tonal, con ícono), `Skeleton`, `EstadoError`, `DialogoReasignar`.
- **Estados:** cargando → `Skeleton` bloque; error → `EstadoError` con código y Reintentar (`errorJerarquia`); sin Administradores → `administradoresVacio`; rama sin hijos → `ramaVacia` ("Todavía no tiene Titulares ni Guardias."); sin permiso `seguridad.administrador.reasignar` → no hay botones, el árbol es de solo lectura.
- **Accesibilidad:** `aria-label` del botón con el nombre ("Reasignar a {nombre} a otro administrador", `reasignarA`); la jerarquía es una lista anidada semántica (`ul`/`li`) y el nivel se comunica con texto, no solo con la sangría.
- **Propuesta:** expandir un Titular para ver sus Miembros (hoy solo el conteo), y mostrar los Titulares y Guardias en grupos rotulados.

### B2. "Uso de los usuarios" (estadísticas, `usoRamas` incluido)

- **Propósito:** lo mismo que A4 para AGROCOM, de toda la cuenta, más cuántos usuarios cuelgan de cada Administrador. Informativo: la baja la decide cada Administrador desde la app.
- **Archivo:** `UsoDeUsuarios.tsx` (título `detalle:usoTitulo`).
- **Estructura:** `Aviso` informativo con los umbrales (`usoAviso`) y cuatro grupos con `h3` y lista: usuarios inactivos, usuarios ruidosos, Titulares cerca de su tope y "Usuarios por administrador" (`usoRamas`, con `usoDetalleRama`). Cada fila: nombre en negrita y detalle debajo, con separador `--borde` entre filas.
  - **1440×900:** una columna dentro de la tarjeta.
- **Componentes existentes:** `Aviso`, `Skeleton`, `EstadoError`.
- **Estados:** cargando → `Skeleton`; error → `EstadoError` (`errorUso`); vacío por grupo → texto `usoSinInactivos`, `usoSinRuidosos`, `usoSinTitulares`, `administradoresVacio`; sin permiso → la API responde 403 y se ve el error (no se oculta por permiso en la UI).
- **Accesibilidad:** títulos de grupo con conteo en el texto (plural), lista semántica; sin color como único canal.
- **Propuesta:** ocultar la tarjeta si el usuario no tiene el permiso de estadísticas, en lugar de mostrar un error; y un indicador visual (`BarraUso`, ya existente) para "miembros / tope" de cada Titular.

### B3. Diálogo de reasignar Guardia o unidad

- **Propósito:** mover un Guardia, o un Titular con su unidad y sus Miembros, a otro Administrador. Solo AGROCOM; el cupo no cambia; queda en la bitácora (ADR 0028 §7).
- **Archivo:** `DialogoReasignar.tsx`.
- **Estructura:** `Dialogo` ancho "ancho", título "Reasignar a {nombre}", párrafo explicativo (`reasignarTextoTitular` con el conteo de Miembros, o `reasignarTextoGuardia`), selector "Nuevo administrador" (`AccesoSelectorBuscable` sin búsqueda; opciones = los demás Administradores) y acciones Cancelar / Reasignar.
- **Componentes existentes:** `Dialogo`, `AccesoBoton`, `AccesoSelectorBuscable`, `Aviso`.
- **Estados:** sin destino elegido → "Reasignar" deshabilitado; guardando → botón en carga con "Reasignando"; error → `Aviso` peligro con el mensaje traducido del código de error; al cerrar se limpia el estado; sin permiso → no se abre (el botón de B1 no existe).
- **Accesibilidad:** `Dialogo` gestiona foco y cierre con Esc; el selector tiene etiqueta visible.
- **Propuesta:** si la cuenta tiene un solo Administrador, no hay a dónde mover: mostrar un aviso informativo y deshabilitar el selector (hoy queda una lista vacía sin explicación).

### B4. Diálogo de agregar administrador

- **Propósito:** una cuenta puede tener varios Administradores (ADR 0028 §1). Cuenta en el cupo del plan.
- **Archivos:** `DialogoAgregarAdministrador.tsx`, invocado desde `AdministradoresDeCuenta.tsx` (botón tonal "Agregar administrador", ícono `person_add`, con el permiso `seguridad.administrador.crear`).
- **Estructura:** `Dialogo` ancho "ancho"; texto `agregarAdminTexto`; campo "Nombre del administrador" (máx. 80, requerido) y campo mono "Últimos 4 caracteres del PIN" (opcional; vacío = lo sortea el servidor); acciones Cancelar / Agregar. Al terminar, otro `Dialogo` muestra el PIN **una sola vez** con `PinUnaVez` (`adminNuevoTitulo`, `adminNuevoAviso`); el PIN vive solo en el estado del componente.
- **Componentes existentes:** `Dialogo`, `AccesoCampoTexto`, `Aviso`, `AccesoBoton`, `PinUnaVez`, `ConfirmarDialogo` (para regenerar), `Avatar`, `Skeleton`, `EstadoError`.
- **Estados:** nombre vacío o sufijo inválido → botón deshabilitado y error en el campo tras tocarlo (`agregarAdminNombreRequerido`, `agregarAdminSufijoInvalido`); guardando → "Agregando"; error de la API (p. ej. cupo lleno) → `Aviso` peligro traducido; lista de Administradores: cargando `Skeleton`, error `EstadoError`, vacía `administradoresVacio`; sin permiso → el botón no se dibuja.
- **Accesibilidad:** campos con etiqueta, ayuda y error textual; el sufijo en mono para distinguir 0/O.
- **Propuesta:** `PinUnaVez` dice "Cópialo", pero en la app el criterio es Compartir; unificar el mensaje de entrega (ver inconsistencias).

### B5. Edición del tope de Miembros por Titular

- **Propósito:** configurar por cuenta cuántos Miembros puede crear cada Titular (por defecto 10).
- **Archivos:** `DialogoEditarCuenta.tsx` (campo `detalle:maxMiembros`, ayuda `maxMiembrosAyuda`, error `maxMiembrosInvalido`); el valor vigente se ve en la tarjeta "Empresa" de `ResumenDeCuenta.tsx` (`FilaClaveValor`).
- **Estructura:** último campo del diálogo "Editar {cuenta}" (ancho "amplio"), campo mono numérico, tras los datos de la empresa y de la persona responsable. Guardar envía `maxMiembrosPorTitular` junto con el resto.
- **Componentes existentes:** `Dialogo`, `AccesoCampoTexto`, `AccesoSelectorBuscable`, `FilaClaveValor`.
- **Estados:** vacío o fuera de 1..`MAX_MIEMBROS_POR_TITULAR` → error en el campo y "Guardar cambios" deshabilitado; guardando → "Guardando"; error de API → `Aviso` peligro; sin permiso `seguridad.cuenta.editar` → no existe el botón "Editar" que abre el diálogo.
- **Accesibilidad:** `inputMode="numeric"`, error textual enlazado al campo.
- **Propuesta:** avisar que bajar el tope no da de baja a nadie: solo impide crear más Miembros a los Titulares que ya lo superan.

---

## Inconsistencias entre el código y el diseño

1. **Titular y selector de rol (app):** el ADR 0028 §3 y `jerarquia-de-usuarios.md` §9 dicen "sin selector" para el Titular. `SelectorDeRol` filtra los roles, pero con una sola opción (Miembro) sigue mostrando un radio sin preseleccionar; hay que elegirlo, y si no se elige aparece "Elige un rol." Nadie llama a `elegirRol` automáticamente.
2. **`sistema-diseno.md` está desfasado:** §2.6 y §3 siguen diciendo "Emitir QR" (el código y el ARB dicen "Generar QR"), el Administrador en compacto como "Inicio · Eventos · Admin · Perfil" (el código da Inicio · Mis QR · Admin · Perfil, con Eventos cediendo su lugar) y el rail del Administrador y el rol "Usuario/Guardia/Administrador" sin los niveles Titular/Miembro. Falta además en el catálogo cualquier mención del cupo, las estadísticas y el selector de nivel. (Este archivo no se modificó.)
3. **Dos íconos para el QR propio:** `how_to_reg` en la cabecera (`BotonQrPropio`) y `person_pin_outlined` en el acceso rápido de `InicioUsuario`; `jerarquia-de-usuarios.md` §5.4 pedía un ícono tipo "persona entrando".
4. **Bajas en cascada (A5):** la guía §4 pide la ficha "estado → estado" en toda confirmación de cambio de estado; el diálogo de cascada y el de baja de usuario solo llevan texto.
5. **Mensaje de entrega del PIN:** la app solo ofrece "Compartir" (se quitó "Copiar", #69) y el panel web aún dice "Cópialo y entrégalo…" (`pinNuevoAviso`, `adminNuevoAviso`) y el botón "Ya lo copié" (`detalle:listo`).
6. **Estadísticas web sin control por permiso:** `UsoDeUsuarios` se dibuja siempre en la ficha; la app, en cambio, condiciona la tarjeta a `Permisos.verEstadisticas`. Un rol sin ese permiso vería un error en vez de nada.
7. **Reasignar con un solo Administrador:** `DialogoReasignar` abre el selector con cero destinos y sin explicación.
8. **Estadísticas en expandido (app):** Usuarios usa `DataTable` en expandido y las estadísticas una lista de tarjetas en todos los anchos; no hay vista pensada para 1440.
9. **Cupo en la web:** `jerarquia-de-usuarios.md` §6.4 pide cupo habilitado/usado por Administrador; la ficha muestra el cupo total del plan (Resumen) y los usuarios por Administrador (`usoRamas`), pero no el cupo desglosado.
10. **Nota del documento de gestión:** `jerarquia-de-usuarios.md` §5.3 ("Generar QR → Generar QR") quedó con un texto sin sentido tras el reemplazo masivo de términos; conviene corregirlo (texto de gestión, no de diseño).
