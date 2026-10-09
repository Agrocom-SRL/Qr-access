import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Tono semántico de un badge (handoff): Vigente, Permitido y En línea =
/// primario · Usado = informacion · Vencido = advertencia · Anulado = neutro
/// · Rechazado y Sin conexión = peligro. Cada entidad decide su tono en su
/// propia feature; el átomo solo lo pinta.
enum TonoAcceso { primario, informacion, advertencia, neutro, peligro }

/// Etiqueta de estado de 24 dp: siempre punto + texto, nunca solo color.
class AccesoBadge extends StatelessWidget {
  const new({required this.texto, required this.tono, super.key});

  final String texto;
  final TonoAcceso tono;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final (fondo, color) = switch (tono) {
      TonoAcceso.primario => (colores.primarioSuave, colores.primario),
      TonoAcceso.informacion => (colores.informacionSuave, colores.informacion),
      TonoAcceso.advertencia => (colores.advertenciaSuave, colores.advertencia),
      TonoAcceso.neutro => (colores.fondo, colores.textoSecundario),
      TonoAcceso.peligro => (colores.peligroSuave, colores.peligro),
    };
    return Semantics(
      label: texto,
      child: Container(
        height: tokens.tamano.badge,
        padding: EdgeInsets.symmetric(horizontal: tokens.espacio.s),
        decoration: BoxDecoration(
          color: fondo,
          borderRadius: BorderRadius.circular(tokens.radio.completo),
          border: tono == TonoAcceso.neutro
              ? Border.all(color: colores.borde)
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: tokens.tamano.puntoBadge,
              height: tokens.tamano.puntoBadge,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            SizedBox(width: tokens.espacio.xs),
            Text(
              texto,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color,
                fontWeight: tokens.tipografia.semiNegrita,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
