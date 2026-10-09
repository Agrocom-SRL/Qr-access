import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Interruptor (handoff §Átomos): activo en primario con el pulgar en
/// sobrePrimario; foco con contorno a 2 dp.
class AccesoInterruptor extends StatelessWidget {
  const new({
    required this.activo,
    required this.alCambiar,
    required this.etiqueta,
    super.key,
  });

  final bool activo;

  /// `null` para deshabilitarlo.
  final ValueChanged<bool>? alCambiar;

  /// Texto para lectores de pantalla.
  final String etiqueta;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      label: etiqueta,
      toggled: activo,
      child: SizedBox(
        height: tokens.tamano.controlMinimo,
        child: Switch(value: activo, onChanged: alCambiar),
      ),
    );
  }
}
