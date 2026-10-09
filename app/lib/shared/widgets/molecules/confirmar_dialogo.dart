import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Confirmación de toda baja o cambio de estado (guía de pantallas §3). El
/// botón de confirmar lleva el tono del estado destino.
class ConfirmarDialogo extends StatelessWidget {
  const new({
    required this.titulo,
    required this.mensaje,
    required this.textoConfirmar,
    this.variante = VarianteBoton.peligro,
    super.key,
  });

  final String titulo;
  final String mensaje;
  final String textoConfirmar;
  final VarianteBoton variante;

  /// Abre el diálogo y devuelve `true` solo si la persona confirma. Cerrarlo
  /// de cualquier otra forma cuenta como cancelar.
  static Future<bool> mostrar(
    BuildContext context, {
    required String titulo,
    required String mensaje,
    required String textoConfirmar,
    VarianteBoton variante = VarianteBoton.peligro,
  }) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => ConfirmarDialogo(
        titulo: titulo,
        mensaje: mensaje,
        textoConfirmar: textoConfirmar,
        variante: variante,
      ),
    );
    return confirmado ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(titulo),
      content: Text(mensaje),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(context.l10n.comunCancelar),
        ),
        AccesoBoton(
          texto: textoConfirmar,
          variante: variante,
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ],
    );
  }
}
