import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Chip de solo lectura con borde (roles de un usuario): radio 6, 12/500.
class ChipEtiqueta extends StatelessWidget {
  const new({required this.texto, super.key});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: tokens.espacio.s,
        vertical: tokens.espacio.xxs,
      ),
      decoration: BoxDecoration(
        border: Border.all(color: tokens.colores.borde),
        borderRadius: BorderRadius.circular(tokens.radio.s),
      ),
      child: Text(
        texto,
        style: Theme.of(context).textTheme.labelSmall
            ?.copyWith(color: tokens.colores.textoSecundario),
      ),
    );
  }
}
