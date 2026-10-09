import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Campo de texto de la app: la etiqueta siempre visible y el error debajo
/// (sistema de diseño §3). Los textos llegan ya traducidos desde la pantalla.
class AccesoCampoTexto extends StatelessWidget {
  const new({
    required this.etiqueta,
    this.controlador,
    this.ayuda,
    this.textoError,
    this.formateadores = const [],
    this.teclado,
    this.ocultar = false,
    this.habilitado = true,
    this.accionTeclado = TextInputAction.done,
    this.alCambiar,
    this.alEnviar,
    super.key,
  });

  final String etiqueta;
  final TextEditingController? controlador;

  /// Texto de ayuda bajo el campo, mientras no haya error.
  final String? ayuda;

  /// Mensaje de error bajo el campo; tiene prioridad sobre [ayuda].
  final String? textoError;
  final List<TextInputFormatter> formateadores;
  final TextInputType? teclado;
  final bool ocultar;
  final bool habilitado;
  final TextInputAction accionTeclado;
  final ValueChanged<String>? alCambiar;
  final ValueChanged<String>? alEnviar;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controlador,
      enabled: habilitado,
      obscureText: ocultar,
      autocorrect: false,
      enableSuggestions: !ocultar,
      keyboardType: teclado,
      inputFormatters: formateadores,
      textInputAction: accionTeclado,
      onChanged: alCambiar,
      onSubmitted: alEnviar,
      decoration: InputDecoration(
        labelText: etiqueta,
        helperText: textoError == null ? ayuda : null,
        errorText: textoError,
      ),
    );
  }
}
