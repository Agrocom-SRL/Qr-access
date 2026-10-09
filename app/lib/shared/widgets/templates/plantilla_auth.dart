import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Plantilla de las pantallas sin sesión y de los pasos previos a ella
/// (inicio de sesión, elegir rol): contenido centrado con ancho máximo de
/// formulario, en móvil y en web.
class PlantillaAuth extends StatelessWidget {
  const new({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(tokens.espacio.xl),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: tokens.tamano.formularioMaximo,
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
