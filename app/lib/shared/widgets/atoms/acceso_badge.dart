import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Tono semántico de un badge. Cada entidad decide su tono en su propia
/// feature (un mapa por entidad, sistema de diseño §4); el átomo solo lo pinta.
enum TonoAcceso { neutro, primario, exito, advertencia, peligro, informacion }

/// Etiqueta de estado. Siempre lleva texto: el color nunca es el único
/// indicador (sistema de diseño §5).
class AccesoBadge extends StatelessWidget {
  const new({required this.texto, required this.tono, super.key});

  final String texto;
  final TonoAcceso tono;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final color = switch (tono) {
      TonoAcceso.neutro => colores.textoSecundario,
      TonoAcceso.primario => colores.primario,
      TonoAcceso.exito => colores.exito,
      TonoAcceso.advertencia => colores.advertencia,
      TonoAcceso.peligro => colores.peligro,
      TonoAcceso.informacion => colores.informacion,
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(tokens.radio.completo),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: tokens.espacio.s,
          vertical: tokens.espacio.xxs,
        ),
        child: Text(
          texto,
          style: Theme.of(context).textTheme.labelMedium
              ?.copyWith(color: colores.sobrePrimario),
        ),
      ),
    );
  }
}
