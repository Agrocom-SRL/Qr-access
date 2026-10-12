import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_logo.dart';
import 'package:flutter/material.dart';

/// Plantilla de Bienvenida, Ingreso y Elegir rol (handoff): contenido con
/// ancho máximo 400; en expandido, panel de marca verde a la izquierda (50 %).
class PlantillaAuth extends StatelessWidget {
  const new({
    required this.child,
    this.alVolver,
    this.pie,
    this.cabeceraConFoto = false,
    this.centrado = false,
    this.conPanelDeMarca = true,
    this.anchoMaximo,
    super.key,
  });

  final Widget child;

  /// Muestra la flecha de volver arriba a la izquierda.
  final VoidCallback? alVolver;

  /// Acción fija abajo (botón principal).
  final Widget? pie;

  /// En compacto, una cabecera con la foto del edificio, el logo y la flecha
  /// de volver encima (la flecha deja de ir sola arriba).
  final bool cabeceraConFoto;

  /// Centra el contenido en vertical (expandido) en vez de alinearlo arriba.
  final bool centrado;

  /// En expandido, el panel verde de marca a la izquierda. Elegir rol (E03)
  /// no lo lleva: son tarjetas en fila sobre todo el ancho.
  final bool conPanelDeMarca;

  /// Ancho máximo del contenido; por defecto, el de auth (400).
  final double? anchoMaximo;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final expandida = context.esExpandida;
    final contenido = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (cabeceraConFoto && !expandida)
          CabeceraFoto(alVolver: alVolver)
        else if (alVolver != null)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: IconButton(
              tooltip: context.l10n.comunVolver,
              onPressed: alVolver,
              icon: const Icon(Icons.arrow_back),
            ),
          ),
        Expanded(
          child: Align(
            alignment: expandida && centrado
                ? Alignment.center
                : Alignment.topCenter,
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: tokens.espacio.l,
                vertical: tokens.espacio.xl,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: anchoMaximo ?? tokens.tamano.maxAuth,
                  ),
                  child: child,
                ),
              ),
            ),
          ),
        ),
        if (pie != null)
          Padding(
            padding: EdgeInsets.all(tokens.espacio.l),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: tokens.tamano.maxAuth),
                child: pie,
              ),
            ),
          ),
      ],
    );
    return Scaffold(
      body: SafeArea(
        child: expandida && conPanelDeMarca
            ? Row(
                children: [
                  const Expanded(child: PanelDeMarca()),
                  Expanded(child: contenido),
                ],
              )
            : contenido,
      ),
    );
  }
}

/// Panel verde con el logo y la frase de la marca (E01 y E02).
class PanelDeMarca extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    return Stack(
      fit: StackFit.expand,
      children: [
        const AccesoFoto(ruta: Multimedia.fotoBienvenida),
        Padding(
          padding: EdgeInsets.all(tokens.espacio.xxxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AccesoLogo(sobreHero: true),
              const Spacer(),
              Text(
                context.l10n.appTitulo,
                style: textos.headlineLarge?.copyWith(color: colores.sobreHero),
              ),
              SizedBox(height: tokens.espacio.s),
              Text(
                context.l10n.bienvenidaFrase,
                style: textos.bodyLarge?.copyWith(color: colores.sobreHero),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Cabecera del ingreso en compacto: la foto del edificio bajo una capa verde
/// que se funde con el fondo, la placa del logo y la flecha de volver encima.
class CabeceraFoto extends StatelessWidget {
  const new({this.alVolver, super.key});

  final VoidCallback? alVolver;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    return SizedBox(
      height: tokens.tamano.cabeceraFoto,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const AccesoFoto(
            ruta: Multimedia.fotoIngreso,
            alineacion: Alignment(0, 0.4),
            fundirConFondo: true,
          ),
          if (alVolver != null)
            Align(
              alignment: AlignmentDirectional.topStart,
              child: IconButton(
                tooltip: context.l10n.comunVolver,
                onPressed: alVolver,
                color: colores.sobreHero,
                icon: const Icon(Icons.arrow_back),
              ),
            ),
          Align(
            alignment: Alignment.bottomCenter,
            child: ExcludeSemantics(
              child: Image.asset(
                Multimedia.logoPlaca,
                width: tokens.tamano.placaCabecera,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
