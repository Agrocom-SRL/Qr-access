import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Acciones de fila con color fijo (handoff): Ver = informacion, Editar =
/// advertencia, Eliminar = peligro. Siempre con tooltip y semántica.
enum AccionDeFila { ver, editar, eliminar }

/// Botón de ícono cuadrado (radio 10, fondo suave) para una acción de fila.
class AccesoAccionFila extends StatelessWidget {
  const new({
    required this.accion,
    required this.etiqueta,
    required this.onPressed,
    super.key,
  });

  final AccionDeFila accion;

  /// Texto del tooltip y del lector de pantalla, ya traducido.
  final String etiqueta;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final (fondo, color, icono) = switch (accion) {
      AccionDeFila.ver => (
        colores.informacionSuave,
        colores.informacion,
        Icons.visibility_outlined,
      ),
      AccionDeFila.editar => (
        colores.advertenciaSuave,
        colores.advertencia,
        Icons.edit_outlined,
      ),
      AccionDeFila.eliminar => (
        colores.peligroSuave,
        colores.peligro,
        Icons.delete_outline,
      ),
    };
    return IconButton(
      tooltip: etiqueta,
      onPressed: onPressed,
      icon: Icon(icono, size: tokens.tamano.icono),
      style: IconButton.styleFrom(
        backgroundColor: fondo,
        foregroundColor: color,
        minimumSize: Size.square(tokens.tamano.controlMinimo),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radio.m),
        ),
      ),
    );
  }
}
