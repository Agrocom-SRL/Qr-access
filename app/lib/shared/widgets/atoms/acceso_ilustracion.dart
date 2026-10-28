import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Ilustración decorativa de un estado (vacío, error, sin conexión, bloqueo):
/// 160 dp (200 en expandido), y 88 cuando la altura es poca (teléfono en
/// horizontal) para que el título no quede tapado. Es decorativa: el título y
/// la ayuda que la acompañan ya dicen lo mismo, así que los lectores de
/// pantalla la saltan.
///
/// Con [grande], en horizontal de teléfono usa `ilustracionApaisada`: es para
/// las pantallas que le dan una columna entera (anulación), donde 88 dp se
/// pierde.
class AccesoIlustracion extends StatelessWidget {
  const new({required this.ruta, this.grande = false, this.lado, super.key});

  /// Ruta del SVG (ver `Multimedia`).
  final String ruta;

  /// La ilustración tiene una columna propia en horizontal.
  final bool grande;

  /// Lado fijo, cuando el espacio es conocido y ninguno de los tamaños
  /// automáticos sirve.
  final double? lado;

  @override
  Widget build(BuildContext context) {
    final tamano = context.tokens.tamano;
    final medida =
        lado ??
        (context.esAlturaCorta
            ? (grande
                  ? tamano.ilustracionApaisada
                  : tamano.ilustracionAlturaCorta)
            : context.esExpandida
            ? tamano.ilustracionExpandida
            : tamano.ilustracion);
    return Semantics(
      excludeSemantics: true,
      child: SvgPicture.asset(ruta, width: medida, height: medida),
    );
  }
}
