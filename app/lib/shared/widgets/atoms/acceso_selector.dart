import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Una opción de `AccesoSelector`.
class OpcionSelector<T> {
  const new({required this.valor, required this.etiqueta});

  final T valor;
  final String etiqueta;
}

/// Lista desplegable (handoff §Átomos): mismo alto y radio que el campo de
/// texto, con el check en la opción elegida. Sin opciones queda deshabilitado
/// con el texto de [placeholder].
class AccesoSelector<T> extends StatelessWidget {
  const new({
    required this.opciones,
    required this.seleccionado,
    required this.alElegir,
    required this.placeholder,
    this.iconoInicial,
    this.habilitado = true,
    super.key,
  });

  final List<OpcionSelector<T>> opciones;
  final T? seleccionado;
  final ValueChanged<T?> alElegir;
  final String placeholder;
  final IconData? iconoInicial;
  final bool habilitado;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return DropdownButtonFormField<T>(
      initialValue: seleccionado,
      isExpanded: true,
      onChanged: habilitado && opciones.isNotEmpty ? alElegir : null,
      icon: Icon(Icons.expand_more, size: tokens.tamano.iconoNav),
      borderRadius: BorderRadius.circular(tokens.radio.m),
      dropdownColor: tokens.colores.superficieElevada,
      style: Theme.of(context).textTheme.bodyLarge,
      hint: Text(placeholder),
      decoration: InputDecoration(
        prefixIcon: iconoInicial == null
            ? null
            : Icon(iconoInicial, size: tokens.tamano.icono),
      ),
      items: [
        for (final opcion in opciones)
          DropdownMenuItem<T>(
            value: opcion.valor,
            child: Row(
              children: [
                Expanded(
                  child: Text(opcion.etiqueta, overflow: TextOverflow.ellipsis),
                ),
                if (opcion.valor == seleccionado)
                  Icon(
                    Icons.check,
                    size: tokens.tamano.icono,
                    color: tokens.colores.primario,
                  ),
              ],
            ),
          ),
      ],
      selectedItemBuilder: (context) => [
        for (final opcion in opciones)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(opcion.etiqueta, overflow: TextOverflow.ellipsis),
          ),
      ],
    );
  }
}
