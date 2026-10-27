import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_logo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:flutter/material.dart';

/// Teléfono en horizontal: lado corto menor que el breakpoint de teléfono
/// (600 dp) y más ancho que alto (regla del proyecto). Un tablet o la web de
/// escritorio no la cumplen y conservan su layout.
bool esTelefonoApaisado(BuildContext context) {
  final tamano = MediaQuery.sizeOf(context);
  return tamano.shortestSide < context.tokens.breakpoint.ladoCorto &&
      tamano.width > tamano.height;
}

/// Plantilla de Bienvenida, Ingreso y Elegir rol (handoff): contenido con
/// ancho máximo 400; en expandido, panel de marca verde a la izquierda (50 %).
/// En teléfono horizontal, con [cabeceraConFoto], la foto va a un lado y el
/// formulario al otro, con scroll, para que el campo del PIN quede a la vista.
class PlantillaAuth extends StatelessWidget {
  const new({
    required this.child,
    this.alVolver,
    this.pie,
    this.cabeceraConFoto = false,
    this.fotoCabecera = Multimedia.fotoIngreso,
    this.alineacionFotoCabecera = const Alignment(0, 0.4),
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
  /// de volver encima (la flecha deja de ir sola arriba). En teléfono
  /// horizontal, la misma foto ocupa una columna a la izquierda.
  final bool cabeceraConFoto;

  /// Foto de esa cabecera y la zona que se deja a la vista al recortarla.
  final String fotoCabecera;
  final AlignmentGeometry alineacionFotoCabecera;

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
    final apaisada =
        cabeceraConFoto && !expandida && esTelefonoApaisado(context);

    final columna = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (cabeceraConFoto && !expandida)
          CabeceraFoto(
            alVolver: alVolver,
            ruta: fotoCabecera,
            alineacion: alineacionFotoCabecera,
          )
        else if (alVolver != null)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: BotonSalidaCabecera(
              salida: SalidaDeCabecera.volver,
              alPulsar: alVolver!,
            ),
          ),
        Expanded(
          child: _Formulario(
            anchoMaximo: anchoMaximo,
            pie: pie,
            alineacion: expandida && centrado
                ? Alignment.center
                : Alignment.topCenter,
            padding: EdgeInsets.symmetric(
              horizontal: tokens.espacio.l,
              vertical: tokens.espacio.xl,
            ),
            margenPie: EdgeInsets.all(tokens.espacio.l),
            child: child,
          ),
        ),
      ],
    );

    final cuerpo = apaisada
        ? Row(
            children: [
              Expanded(
                flex: 2,
                child: CabeceraFoto(
                  alVolver: alVolver,
                  ruta: fotoCabecera,
                  alineacion: alineacionFotoCabecera,
                  llenarAlto: true,
                ),
              ),
              Expanded(
                flex: 3,
                child: _Formulario(
                  anchoMaximo: anchoMaximo,
                  pie: pie,
                  alineacion: Alignment.topCenter,
                  // Menos aire que en vertical: el PIN, el título y el botón
                  // tienen que caber a la vista sin desplazarse.
                  padding: EdgeInsets.symmetric(
                    horizontal: tokens.espacio.l,
                    vertical: tokens.espacio.m,
                  ),
                  margenPie: EdgeInsets.all(tokens.espacio.m),
                  child: child,
                ),
              ),
            ],
          )
        : columna;

    return PopScope(
      // Con flecha de volver, "atrás" hace lo mismo que ella en vez de salir.
      canPop: alVolver == null,
      onPopInvokedWithResult: (salio, _) {
        if (!salio) alVolver?.call();
      },
      child: Scaffold(
        body: SafeArea(
          child: expandida && conPanelDeMarca
              ? Row(
                  children: [
                    const Expanded(child: PanelDeMarca()),
                    Expanded(child: columna),
                  ],
                )
              : cuerpo,
        ),
      ),
    );
  }
}

/// Contenido desplazable con su acción fija abajo. Va igual en vertical y en
/// teléfono horizontal; solo cambian las medidas que le pasa la plantilla.
class _Formulario extends StatelessWidget {
  const new({
    required this.child,
    required this.alineacion,
    required this.padding,
    required this.margenPie,
    this.anchoMaximo,
    this.pie,
  });

  final Widget child;
  final AlignmentGeometry alineacion;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margenPie;
  final double? anchoMaximo;
  final Widget? pie;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      children: [
        Expanded(
          child: Align(
            alignment: alineacion,
            child: SingleChildScrollView(
              padding: padding,
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
            padding: margenPie,
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: anchoMaximo ?? tokens.tamano.maxAuth,
                ),
                child: pie,
              ),
            ),
          ),
      ],
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
/// Con [llenarAlto] ocupa todo el alto que le dé su padre (teléfono
/// horizontal, donde es una columna a un lado del formulario).
class CabeceraFoto extends StatelessWidget {
  const new({
    this.alVolver,
    this.ruta = Multimedia.fotoIngreso,
    this.alineacion = const Alignment(0, 0.4),
    this.llenarAlto = false,
    super.key,
  });

  final VoidCallback? alVolver;
  final String ruta;
  final AlignmentGeometry alineacion;
  final bool llenarAlto;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final pila = Stack(
      fit: StackFit.expand,
      children: [
        AccesoFoto(ruta: ruta, alineacion: alineacion, fundirConFondo: true),
        if (alVolver != null)
          Align(
            alignment: AlignmentDirectional.topStart,
            child: BotonSalidaCabecera(
              salida: SalidaDeCabecera.volver,
              alPulsar: alVolver!,
              color: colores.sobreHero,
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
    );
    if (llenarAlto) return pila;
    return SizedBox(height: tokens.tamano.cabeceraFoto, child: pila);
  }
}
