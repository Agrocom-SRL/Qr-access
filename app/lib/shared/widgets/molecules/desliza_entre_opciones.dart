import 'package:flutter/material.dart';

/// Deja pasar de una opción a la vecina deslizando el dedo de lado, como en
/// las pestañas: cambia el valor del selector que lo acompaña. Un deslizamiento
/// lento no cuenta, para no pelear con el scroll vertical ni con los gestos
/// del sistema.
class DeslizaEntreOpciones<T> extends StatelessWidget {
  const new({
    required this.opciones,
    required this.seleccionada,
    required this.alCambiar,
    required this.child,
    this.activo = true,
    super.key,
  });

  /// Las opciones en el orden en que se ven en el selector.
  final List<T> opciones;
  final T seleccionada;
  final ValueChanged<T> alCambiar;
  final Widget child;

  /// En pantallas anchas (tabla, ratón) no se desliza.
  final bool activo;

  /// Velocidad mínima del deslizamiento, en dp por segundo.
  static const double _velocidadMinima = 350;

  void _alSoltar(DragEndDetails detalles) {
    final velocidad = detalles.primaryVelocity ?? 0;
    if (velocidad.abs() < _velocidadMinima) return;
    final actual = opciones.indexOf(seleccionada);
    if (actual < 0) return;
    // Deslizar hacia la izquierda (velocidad negativa) avanza; la dirección del
    // texto invierte el sentido.
    final haciaAdelante = velocidad < 0;
    final destino = actual + (haciaAdelante ? 1 : -1);
    if (destino < 0 || destino >= opciones.length) return;
    alCambiar(opciones[destino]);
  }

  @override
  Widget build(BuildContext context) {
    if (!activo) return child;
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: _alSoltar,
      child: child,
    );
  }
}
