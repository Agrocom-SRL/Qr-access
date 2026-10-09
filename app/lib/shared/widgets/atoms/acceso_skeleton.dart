import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Bloque gris que ocupa el lugar del contenido mientras carga, con un barrido
/// de brillo (paquete `shimmer`) de 1200 ms. Con "reducir movimiento" queda
/// quieto (handoff).
class AccesoSkeleton extends StatelessWidget {
  const new({this.ancho, this.alto, this.circular = false, super.key});

  /// `null` = todo el ancho disponible.
  final double? ancho;
  final double? alto;
  final bool circular;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final animado = !MediaQuery.disableAnimationsOf(context);
    return ExcludeSemantics(
      child: Shimmer.fromColors(
        baseColor: colores.borde,
        highlightColor: colores.superficie,
        period: tokens.duracion.pulso,
        enabled: animado,
        // El color que pinta el barrido lo da el hijo: debe ser opaco.
        child: Container(
          width: ancho,
          height: alto ?? tokens.espacio.l,
          decoration: BoxDecoration(
            color: colores.borde,
            borderRadius: circular
                ? null
                : BorderRadius.circular(tokens.radio.s),
            shape: circular ? BoxShape.circle : BoxShape.rectangle,
          ),
        ),
      ),
    );
  }
}
