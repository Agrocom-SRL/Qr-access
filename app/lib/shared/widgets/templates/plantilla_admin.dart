import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_logo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/banner_sin_conexion.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/barra_navegacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Plantilla de las pantallas con sesión (handoff §Breakpoints): barra de
/// navegación inferior en compacto, rail de 80 en medio y rail extendido de
/// 240 en expandido, con el contenido limitado a 1200.
class PlantillaAdmin extends ConsumerWidget {
  const new({
    required this.destino,
    required this.child,
    this.titulo,
    this.subtitulo,
    this.accion,
    this.accionCompacta,
    this.fab,
    this.rutaAtras,
    this.alVolver,
    this.anchoMaximo,
    this.conRelleno = true,
    super.key,
  });

  final DestinoNav destino;
  final Widget child;

  /// Título grande arriba del contenido; `null` si la pantalla trae el suyo.
  final String? titulo;
  final String? subtitulo;

  /// Acción principal a la derecha del título (un `AccesoBoton`).
  final Widget? accion;

  /// En compacto, un ícono en vez del botón; sin él se usa [accion].
  final Widget? accionCompacta;

  /// Botón flotante (compacto): "Generar QR" en Mis QR.
  final Widget? fab;

  /// A dónde lleva "atrás" en una pantalla que no es un destino principal
  /// (un formulario, por ejemplo); por defecto, a Inicio.
  final String? rutaAtras;

  /// Muestra una flecha para volver a la izquierda del título (formularios).
  final VoidCallback? alVolver;
  final double? anchoMaximo;

  /// Relleno horizontal alrededor del contenido; `false` si el contenido lo
  /// maneja (listados con scroll propio).
  final bool conRelleno;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final clase = context.clasePantalla;
    final destinos = destinosPara(sesion, clase);
    final indice = destinos.indexOf(destino);

    final cabecera = titulo == null
        ? null
        : _Cabecera(
            titulo: titulo!,
            subtitulo: subtitulo,
            alVolver: alVolver,
            accion: clase == ClasePantalla.compacta
                ? (accionCompacta ?? accion)
                : accion,
          );
    final contenido = Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: anchoMaximo ?? tokens.tamano.maxContenido,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _AvisoDatosGuardados(),
            if (cabecera != null)
              Padding(
                padding: EdgeInsets.fromLTRB(
                  tokens.espacio.l,
                  tokens.espacio.l,
                  tokens.espacio.l,
                  0,
                ),
                child: cabecera,
              ),
            Expanded(
              child: conRelleno
                  ? Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: tokens.espacio.l,
                      ),
                      child: child,
                    )
                  : child,
            ),
          ],
        ),
      ),
    );

    void irA(int i) {
      final elegido = destinos[i];
      if (elegido != destino) context.go(elegido.ruta);
    }

    if (clase == ClasePantalla.compacta) {
      return _AtrasA(
        destino: destino,
        rutaAtras: rutaAtras,
        child: Scaffold(
          body: SafeArea(child: contenido),
          floatingActionButton: fab,
          bottomNavigationBar: BarraNavegacion(
            indice: indice < 0 ? 0 : indice,
            alElegir: irA,
            destinos: [
              for (final d in destinos)
                DestinoBarra(
                  icono: _icono(d, activo: false),
                  iconoActivo: _icono(d, activo: true),
                  etiqueta: _etiqueta(context.l10n, d),
                ),
            ],
          ),
        ),
      );
    }
    final extendido = clase == ClasePantalla.expandida;
    return _AtrasA(
      destino: destino,
      rutaAtras: rutaAtras,
      child: Scaffold(
        body: SafeArea(
          child: Row(
            children: [
              _Rail(
                destinos: destinos,
                indice: indice,
                extendido: extendido,
                sesion: sesion,
                irA: irA,
              ),
              VerticalDivider(width: tokens.tamano.bordeFino),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: tokens.espacio.xl),
                  child: contenido,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _icono(DestinoNav d, {required bool activo}) => switch (d) {
    DestinoNav.inicio => activo ? Icons.home : Icons.home_outlined,
    DestinoNav.generarQr => Icons.qr_code_2,
    DestinoNav.misQr => Icons.qr_code_2,
    DestinoNav.eventos => Icons.history,
    DestinoNav.puertas =>
      activo ? Icons.door_front_door : Icons.door_front_door_outlined,
    DestinoNav.usuarios => activo ? Icons.people : Icons.people_outline,
    DestinoNav.admin => Icons.tune,
    DestinoNav.perfil => activo ? Icons.person : Icons.person_outline,
  };

  static String _etiqueta(AppLocalizations l10n, DestinoNav d) => switch (d) {
    DestinoNav.inicio => l10n.navInicio,
    DestinoNav.generarQr => l10n.navGenerarQr,
    DestinoNav.misQr => l10n.navMisQr,
    DestinoNav.eventos => l10n.navEventos,
    DestinoNav.puertas => l10n.navPuertas,
    DestinoNav.usuarios => l10n.navUsuarios,
    DestinoNav.admin => l10n.navAdmin,
    DestinoNav.perfil => l10n.navPerfil,
  };
}

/// Avisa que lo que se ve son los últimos datos guardados porque no hay
/// conexión (modo sin conexión); desaparece cuando el servidor vuelve a
/// responder.
class _AvisoDatosGuardados extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final guardadoAt = ref.watch(datosGuardadosProvider);
    if (guardadoAt == null) return const SizedBox.shrink();
    final espacio = context.tokens.espacio;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: espacio.l)
          .copyWith(top: espacio.l),
      child: BannerSinConexion(horaDeLosDatos: formatearHora(guardadoAt)),
    );
  }
}

class _Cabecera extends StatelessWidget {
  const new({
    required this.titulo,
    required this.subtitulo,
    required this.accion,
    this.alVolver,
  });

  final String titulo;
  final String? subtitulo;
  final Widget? accion;
  final VoidCallback? alVolver;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (alVolver != null) ...[
          IconButton(
            tooltip: context.l10n.comunAtras,
            icon: const Icon(Icons.arrow_back),
            onPressed: alVolver,
          ),
          SizedBox(width: tokens.espacio.s),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: textos.headlineLarge),
              if (subtitulo != null) ...[
                SizedBox(height: tokens.espacio.xs),
                Text(
                  subtitulo!,
                  style: textos.bodyLarge?.copyWith(
                    color: tokens.colores.textoSecundario,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (accion != null) ...[SizedBox(width: tokens.espacio.l), accion!],
      ],
    );
  }
}

class _Rail extends StatelessWidget {
  const new({
    required this.destinos,
    required this.indice,
    required this.extendido,
    required this.sesion,
    required this.irA,
  });

  final List<DestinoNav> destinos;
  final int indice;
  final bool extendido;
  final SesionEstado sesion;
  final ValueChanged<int> irA;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final textos = Theme.of(context).textTheme;
    final sesion = this.sesion;
    final autenticada = sesion is SesionAutenticada ? sesion : null;
    if (extendido) {
      return _BarraLateral(
        destinos: destinos,
        indice: indice,
        autenticada: autenticada,
        irA: irA,
      );
    }
    return SizedBox(
      width: extendido ? tokens.tamano.railExpandido : tokens.tamano.railMedio,
      child: NavigationRail(
        extended: extendido,
        minExtendedWidth: tokens.tamano.railExpandido,
        minWidth: tokens.tamano.railMedio,
        selectedIndex: indice < 0 ? null : indice,
        onDestinationSelected: irA,
        labelType: extendido
            ? NavigationRailLabelType.none
            : NavigationRailLabelType.all,
        leading: Padding(
          padding: EdgeInsets.symmetric(
            vertical: tokens.espacio.l,
            horizontal: extendido ? tokens.espacio.l : 0,
          ),
          child: SizedBox(
            width: extendido
                ? tokens.tamano.railExpandido - tokens.espacio.xxl
                : null,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AccesoLogo(tamano: tokens.tamano.iconoCaja),
                if (extendido) ...[
                  SizedBox(width: tokens.espacio.m),
                  Flexible(
                    child: Text(
                      l10n.appTitulo,
                      style: textos.titleMedium,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        trailing: autenticada == null
            ? null
            : Expanded(
                child: Align(
                  alignment: extendido
                      ? Alignment.bottomLeft
                      : Alignment.bottomCenter,
                  child: Padding(
                    padding: EdgeInsets.all(tokens.espacio.l),
                    // Extendido: el bloque ocupa todo el ancho del rail y
                    // arranca a la izquierda, alineado con el logo de arriba.
                    child: SizedBox(
                      width: extendido
                          ? tokens.tamano.railExpandido - tokens.espacio.xxl
                          : null,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AccesoAvatar(
                            etiqueta: autenticada.usuario.etiqueta,
                            tamano: tokens.tamano.avatarChico,
                          ),
                          if (extendido) ...[
                            SizedBox(width: tokens.espacio.m),
                            Flexible(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    autenticada.usuario.etiqueta ??
                                        l10n.inicioSaludoSinNombre,
                                    style: textos.titleSmall,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    l10n.perfilRolYCuenta(
                                      autenticada.rolActivo.nombre,
                                      autenticada.cuenta.codigo,
                                    ),
                                    style: textos.bodySmall?.copyWith(
                                      color: tokens.colores.textoSecundario,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
        destinations: [
          for (final d in destinos)
            NavigationRailDestination(
              icon: Icon(PlantillaAdmin._icono(d, activo: false)),
              selectedIcon: Icon(PlantillaAdmin._icono(d, activo: true)),
              label: Text(PlantillaAdmin._etiqueta(l10n, d)),
            ),
        ],
      ),
    );
  }
}

/// Barra lateral del ancho expandido (handoff: rail extendido de 240). Se
/// dibuja a mano porque `NavigationRail` centra el ícono en 80 y deja la
/// pastilla activa solo alrededor de él: acá cada destino es una fila de ancho
/// completo con ícono y texto a la izquierda, y el usuario queda fijo abajo.
class _BarraLateral extends StatelessWidget {
  const new({
    required this.destinos,
    required this.indice,
    required this.autenticada,
    required this.irA,
  });

  final List<DestinoNav> destinos;
  final int indice;
  final SesionAutenticada? autenticada;
  final ValueChanged<int> irA;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final textos = Theme.of(context).textTheme;
    final colores = tokens.colores;
    final usuario = autenticada;
    return Container(
      width: tokens.tamano.railExpandido,
      color: colores.superficie,
      padding: EdgeInsets.all(tokens.espacio.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AccesoLogo(tamano: tokens.tamano.iconoCaja),
              SizedBox(width: tokens.espacio.m),
              Expanded(
                child: Text(
                  l10n.appTitulo,
                  style: textos.titleMedium,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          SizedBox(height: tokens.espacio.xl),
          for (var i = 0; i < destinos.length; i++)
            Padding(
              padding: EdgeInsets.only(bottom: tokens.espacio.xs),
              child: _ItemLateral(
                icono: PlantillaAdmin._icono(destinos[i], activo: i == indice),
                etiqueta: PlantillaAdmin._etiqueta(l10n, destinos[i]),
                activo: i == indice,
                alTocar: () => irA(i),
              ),
            ),
          const Spacer(),
          if (usuario != null)
            Row(
              children: [
                AccesoAvatar(
                  etiqueta: usuario.usuario.etiqueta,
                  tamano: tokens.tamano.avatar,
                ),
                SizedBox(width: tokens.espacio.m),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        usuario.usuario.etiqueta ?? l10n.inicioSaludoSinNombre,
                        style: textos.titleSmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        l10n.perfilRolYCuenta(
                          usuario.rolActivo.nombre,
                          usuario.cuenta.codigo,
                        ),
                        style: textos.bodySmall?.copyWith(
                          color: colores.textoSecundario,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _ItemLateral extends StatelessWidget {
  const new({
    required this.icono,
    required this.etiqueta,
    required this.activo,
    required this.alTocar,
  });

  final IconData icono;
  final String etiqueta;
  final bool activo;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final forma = BorderRadius.circular(tokens.radio.completo);
    return Semantics(
      button: true,
      selected: activo,
      label: etiqueta,
      child: Material(
        color: activo ? colores.primarioSuave : colores.superficie,
        borderRadius: forma,
        child: InkWell(
          borderRadius: forma,
          onTap: alTocar,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: tokens.tamano.control),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
              child: Row(
                children: [
                  Icon(
                    icono,
                    size: tokens.tamano.iconoNav,
                    color: activo ? colores.primario : colores.textoSecundario,
                  ),
                  SizedBox(width: tokens.espacio.m),
                  Expanded(
                    child: Text(
                      etiqueta,
                      style: textos.labelLarge?.copyWith(
                        color: activo ? colores.texto : colores.textoSecundario,
                        fontWeight: activo
                            ? tokens.tipografia.semiNegrita
                            : null,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Atrás" no sale de la app salvo desde Inicio: en un destino vuelve a Inicio
/// y en una pantalla de flujo, a [rutaAtras]. Todo se abre con `go` (reemplaza
/// la pila), así que sin esto el sistema cerraría la app al primer "atrás".
class _AtrasA extends StatelessWidget {
  const new({
    required this.destino,
    required this.rutaAtras,
    required this.child,
  });

  final DestinoNav destino;
  final String? rutaAtras;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: destino == DestinoNav.inicio && rutaAtras == null,
      onPopInvokedWithResult: (salio, _) {
        if (!salio) context.go(rutaAtras ?? DestinoNav.inicio.ruta);
      },
      child: child,
    );
  }
}
