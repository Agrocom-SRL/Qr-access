import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Ficha "estado actual → estado destino" del diálogo (guía §3).
class TransicionDeEstado {
  const new({
    required this.actual,
    required this.tonoActual,
    required this.destino,
    required this.tonoDestino,
  });

  final String actual;
  final TonoAcceso tonoActual;
  final String destino;
  final TonoAcceso tonoDestino;
}

/// Confirmación de toda baja o cambio de estado (guía de pantallas §3). El
/// botón de confirmar lleva el tono del estado destino.
class ConfirmarDialogo extends StatelessWidget {
  const new({
    required this.titulo,
    required this.mensaje,
    required this.textoConfirmar,
    this.transicion,
    this.variante = VarianteBoton.peligroRelleno,
    this.textoCancelar,
    super.key,
  });

  final String titulo;
  final String mensaje;
  final String textoConfirmar;
  final TransicionDeEstado? transicion;
  final VarianteBoton variante;
  final String? textoCancelar;

  /// Abre el diálogo y devuelve `true` solo si la persona confirma. Cerrarlo
  /// de cualquier otra forma cuenta como cancelar.
  static Future<bool> mostrar(
    BuildContext context, {
    required String titulo,
    required String mensaje,
    required String textoConfirmar,
    TransicionDeEstado? transicion,
    VarianteBoton variante = VarianteBoton.peligroRelleno,
    String? textoCancelar,
  }) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => ConfirmarDialogo(
        titulo: titulo,
        mensaje: mensaje,
        textoConfirmar: textoConfirmar,
        transicion: transicion,
        variante: variante,
        textoCancelar: textoCancelar,
      ),
    );
    return confirmado ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final transicion = this.transicion;
    return AlertDialog(
      title: Text(titulo),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (transicion != null) ...[
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: tokens.espacio.s,
              runSpacing: tokens.espacio.xs,
              children: [
                AccesoBadge(
                  texto: transicion.actual,
                  tono: transicion.tonoActual,
                ),
                Icon(
                  Icons.arrow_forward,
                  size: tokens.tamano.icono,
                  color: tokens.colores.textoSecundario,
                ),
                AccesoBadge(
                  texto: transicion.destino,
                  tono: transicion.tonoDestino,
                ),
              ],
            ),
            SizedBox(height: tokens.espacio.m),
          ],
          Text(mensaje),
        ],
      ),
      actions: [
        AccesoBoton(
          texto: textoCancelar ?? context.l10n.comunCancelar,
          variante: VarianteBoton.texto,
          onPressed: () => Navigator.of(context).pop(false),
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
