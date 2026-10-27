import 'package:flutter/material.dart';

/// Centra su contenido en el alto disponible y lo desplaza cuando no cabe (el
/// teléfono en horizontal tiene poco alto). Va dentro de un scrollable con
/// `AlwaysScrollableScrollPhysics`, así que el gesto de "actualizar" funciona
/// también cuando la lista está vacía.
///
/// Si el alto es ilimitado (está dentro de otro scrollable), no hay alto que
/// repartir: solo centra y deja que el scrollable de afuera se encargue.
/// Un `SingleChildScrollView` dentro de otro sin límite de alto no se puede
/// dibujar, así que aquí no se anida.
class CentradoDesplazable extends StatelessWidget {
  const new({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, restricciones) {
        if (!restricciones.hasBoundedHeight) {
          return Center(child: child);
        }
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: restricciones.maxHeight),
            child: Center(child: child),
          ),
        );
      },
    );
  }
}
