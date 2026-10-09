import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Marcador de posición del logo (pendiente de negocio, handoff §Recursos):
/// un cuadrado de radio 20 con rayas de la marca. Cambiar el logo es cambiar
/// este widget.
class AccesoLogo extends StatelessWidget {
  const new({this.tamano, this.sobreHero = false, super.key});

  final double? tamano;

  /// Sobre el hero verde va en tono acento; sobre superficie, en suave.
  final bool sobreHero;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final lado = tamano ?? tokens.tamano.logo;
    final (fondo, rayas) = sobreHero
        ? (colores.heroAcento, colores.hero)
        : (colores.primarioSuave, colores.superficie);
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(
          lado >= tokens.tamano.logo ? tokens.radio.xl : tokens.radio.m,
        ),
        child: CustomPaint(
          size: Size.square(lado),
          painter: _RayasPintor(fondo: fondo, rayas: rayas),
        ),
      ),
    );
  }
}

class _RayasPintor extends CustomPainter {
  const new({required this.fondo, required this.rayas});

  final Color fondo;
  final Color rayas;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = fondo);
    final pincel = Paint()
      ..color = rayas
      ..strokeWidth = size.width / 10;
    final paso = size.width / 5;
    for (var x = -size.width; x < size.width * 2; x += paso) {
      canvas.drawLine(
        Offset(x, size.height),
        Offset(x + size.width, 0),
        pincel,
      );
    }
  }

  @override
  bool shouldRepaint(_RayasPintor antiguo) =>
      antiguo.fondo != fondo || antiguo.rayas != rayas;
}
