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
    this.verdeEnClaro = false,
    this.fundidoHaciaLado = false,
    super.key,
  });

  /// Ruta del asset (ver `Multimedia`).
  final String ruta;
  final AlignmentGeometry alineacion;

  /// Termina en el fondo de la pantalla (cabecera) en vez de en verde (hero).
  final bool fundirConFondo;

  /// Con [fundirConFondo], en el tema claro el fundido llega al verde de marca
  /// en lugar de al fondo (que es casi blanco y vela la foto como un brillo);
  /// en el oscuro sigue fundiéndose con el fondo.
  final bool verdeEnClaro;

  /// El fundido sale por el borde derecho (foto en columna junto a un
  /// formulario) en vez de por abajo, para que no quede un corte seco entre la
  /// foto y el contenido. Arriba conserva el velo de la flecha de volver.
  final bool fundidoHaciaLado;

  @override
  Widget build(BuildContext context) {
    final colores = context.tokens.colores;
    final claro = Theme.of(context).brightness == Brightness.light;
    final fin = fundirConFondo && !(verdeEnClaro && claro)
        ? Theme.of(context).scaffoldBackgroundColor
        : colores.hero.withValues(alpha: opacidadFundidoFoto);
    return ExcludeSemantics(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(ruta, fit: BoxFit.cover, alignment: alineacion),
          if (fundidoHaciaLado) ...[
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    colores.heroAcento.withValues(alpha: opacidadAcentoFoto),
                    colores.hero.withValues(alpha: 0),
                  ],
                  stops: const [0, 0.35],
                ),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: AlignmentDirectional.centerStart,
                  end: AlignmentDirectional.centerEnd,
                  colors: [colores.hero.withValues(alpha: 0), fin],
                  stops: const [0.5, 1],
                ),
              ),
            ),
          ] else
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    colores.heroAcento.withValues(alpha: opacidadAcentoFoto),
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
