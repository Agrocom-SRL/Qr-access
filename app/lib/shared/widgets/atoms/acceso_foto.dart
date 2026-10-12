import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Foto a pantalla del contenedor con una capa que cuida la lectura sin tapar
/// la imagen: oscurece un poco arriba (flecha de volver) y, según
/// [fundirConFondo], se funde con el fondo de la pantalla o con el verde de
/// marca hacia abajo, donde va el texto. La foto es decorativa: no se anuncia.
class AccesoFoto extends StatelessWidget {
  const new({
    required this.ruta,
    this.alineacion = Alignment.center,
    this.fundirConFondo = false,
    super.key,
  });

  /// Ruta del asset (ver `Multimedia`).
  final String ruta;
  final AlignmentGeometry alineacion;

  /// Termina en el fondo de la pantalla (cabecera) en vez de en verde (hero).
  final bool fundirConFondo;

  @override
  Widget build(BuildContext context) {
    final colores = context.tokens.colores;
    final fin = fundirConFondo
        ? Theme.of(context).scaffoldBackgroundColor
        : colores.hero.withValues(alpha: 0.88);
    return ExcludeSemantics(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(ruta, fit: BoxFit.cover, alignment: alineacion),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  colores.heroAcento.withValues(alpha: 0.45),
                  colores.hero.withValues(alpha: 0),
                  fin,
                ],
                stops: const [0, 0.35, 1],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
