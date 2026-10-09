import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Ilustración decorativa de un estado (vacío, error, sin conexión, bloqueo):
/// 160 dp (200 en expandido). Es decorativa: el título y la ayuda que la
/// acompañan ya dicen lo mismo, así que los lectores de pantalla la saltan.
class AccesoIlustracion extends StatelessWidget {
  const new({required this.ruta, super.key});

  /// Ruta del SVG (ver `Multimedia`).
  final String ruta;

  @override
  Widget build(BuildContext context) {
    final tamano = context.tokens.tamano;
    final lado = context.esExpandida
        ? tamano.ilustracionExpandida
        : tamano.ilustracion;
    return Semantics(
      excludeSemantics: true,
      child: SvgPicture.asset(ruta, width: lado, height: lado),
    );
  }
}
