import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_logo.dart';
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

  /// Botón flotante (compacto): "Emitir QR" en Mis QR.
  final Widget? fab;
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
      return Scaffold(
        body: SafeArea(child: contenido),
        floatingActionButton: fab,
        bottomNavigationBar: NavigationBar(
          selectedIndex: indice < 0 ? 0 : indice,
          onDestinationSelected: irA,
          destinations: [
            for (final d in destinos)
              NavigationDestination(
                icon: Icon(_icono(d, activo: false)),
                selectedIcon: Icon(_icono(d, activo: true)),
                label: _etiqueta(context.l10n, d),
              ),
          ],
        ),
      );
    }
    final extendido = clase == ClasePantalla.expandida;
    return Scaffold(
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
    );
  }

  static IconData _icono(DestinoNav d, {required bool activo}) => switch (d) {
    DestinoNav.inicio => activo ? Icons.home : Icons.home_outlined,
    DestinoNav.emitirQr => Icons.qr_code_2,
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
    DestinoNav.emitirQr => l10n.navEmitirQr,
    DestinoNav.misQr => l10n.navMisQr,
    DestinoNav.eventos => l10n.navEventos,
    DestinoNav.puertas => l10n.navPuertas,
    DestinoNav.usuarios => l10n.navUsuarios,
    DestinoNav.admin => l10n.navAdmin,
    DestinoNav.perfil => l10n.navPerfil,
  };
}

class _Cabecera extends StatelessWidget {
  const new({
    required this.titulo,
    required this.subtitulo,
    required this.accion,
  });

  final String titulo;
  final String? subtitulo;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                AccesoLogo(tamano: tokens.tamano.avatarChico),
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
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: EdgeInsets.all(tokens.espacio.m),
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
