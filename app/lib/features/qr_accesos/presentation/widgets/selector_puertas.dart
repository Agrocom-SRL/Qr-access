import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:flutter/material.dart';

/// Lista de puertas con casilla: se puede elegir una o varias (D-17).
class SelectorPuertas extends StatelessWidget {
  const new({
    required this.puertas,
    required this.seleccionadas,
    required this.alAlternar,
    super.key,
  });

  final List<Puerta> puertas;
  final Set<String> seleccionadas;
  final ValueChanged<String> alAlternar;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final puerta in puertas)
          CheckboxListTile(
            value: seleccionadas.contains(puerta.id),
            onChanged: (_) => alAlternar(puerta.id),
            title: Text(puerta.nombre),
            subtitle: Text(puerta.sitioNombre),
            controlAffinity: ListTileControlAffinity.leading,
          ),
      ],
    );
  }
}
