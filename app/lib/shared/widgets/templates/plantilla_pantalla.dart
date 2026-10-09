import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Plantilla de las pantallas con sesión: barra con título y acciones, y
/// contenido con ancho máximo. Un formulario se centra con ancho de formulario;
/// un listado ocupa el ancho de la web, con un tope para no estirarse
/// demasiado (docs/diseno/guia-pantallas.md).
class PlantillaPantalla extends StatelessWidget {
  const new({
    required this.titulo,
    required this.child,
    this.esFormulario = false,
    this.acciones = const [],
    super.key,
  });

  final String titulo;
  final Widget child;

  /// `true` para formularios y pantallas de una sola tarjeta.
  final bool esFormulario;
  final List<Widget> acciones;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final anchoMaximo = esFormulario
        ? tokens.tamano.formularioMaximo
        : tokens.tamano.listadoMaximo;
    return Scaffold(
      appBar: AppBar(title: Text(titulo), actions: acciones),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: anchoMaximo),
            child: child,
          ),
        ),
      ),
    );
  }
}
