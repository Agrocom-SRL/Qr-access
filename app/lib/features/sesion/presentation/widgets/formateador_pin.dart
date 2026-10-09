import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:flutter/services.dart';

/// Deja escribir solo lo que puede ir en un PIN, en mayúsculas y sin espacios
/// (ADR 0018). La regla vive en `Pin.filtrarEntrada`; esto solo la conecta
/// con el campo de texto.
class FormateadorPin extends TextInputFormatter {
  const new();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue anterior,
    TextEditingValue nuevo,
  ) {
    final texto = Pin.filtrarEntrada(nuevo.text);
    return TextEditingValue(
      text: texto,
      selection: TextSelection.collapsed(offset: texto.length),
    );
  }
}
