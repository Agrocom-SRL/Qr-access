import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Bloque gris que ocupa el lugar del contenido mientras carga, con un pulso
/// de opacidad de 1200 ms (estático con "reducir movimiento", handoff).
class AccesoSkeleton extends StatefulWidget {
  const new({this.ancho, this.alto, this.circular = false, super.key});

  /// `null` = todo el ancho disponible.
  final double? ancho;
  final double? alto;
  final bool circular;

  @override
  State<AccesoSkeleton> createState() => _AccesoSkeletonEstado();
}

class _AccesoSkeletonEstado extends State<AccesoSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulso = AnimationController(
    vsync: this,
    lowerBound: 0.4,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final tokens = context.tokens;
    final duracion = tokens.duracion.efectiva(context, tokens.duracion.pulso);
    if (duracion == Duration.zero) {
      _pulso
        ..stop()
        ..value = 1;
    } else if (!_pulso.isAnimating) {
      _pulso
        ..duration = duracion
        ..repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulso.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ExcludeSemantics(
      child: FadeTransition(
        opacity: _pulso,
        child: Container(
          width: widget.ancho,
          height: widget.alto ?? tokens.espacio.l,
          decoration: BoxDecoration(
            color: tokens.colores.borde,
            borderRadius: widget.circular
                ? null
                : BorderRadius.circular(tokens.radio.s),
            shape: widget.circular ? BoxShape.circle : BoxShape.rectangle,
          ),
        ),
      ),
    );
  }
}
