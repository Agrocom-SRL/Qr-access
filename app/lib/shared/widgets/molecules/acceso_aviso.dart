import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

enum TonoAviso { advertencia, informacion, peligro, primario }

/// Aviso en una franja de fondo suave con ícono (handoff: "Después de cerrar
/// no podrás volver a ver este QR", "Abre una sola vez…", bloqueo del PIN).
class AccesoAviso extends StatelessWidget {
  const new({
    required this.texto,
    this.titulo,
    this.tono = TonoAviso.advertencia,
    this.icono,
    this.detalle,
    super.key,
  });

  final String texto;
  final String? titulo;
  final TonoAviso tono;
  final IconData? icono;

  /// Un widget extra debajo del texto (la cuenta regresiva del bloqueo).
  final Widget? detalle;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final (fondo, color, iconoFinal) = switch (tono) {
      TonoAviso.advertencia => (
        colores.advertenciaSuave,
        colores.advertencia,
        Icons.warning_amber_outlined,
      ),
      TonoAviso.informacion => (
        colores.informacionSuave,
        colores.informacion,
        Icons.info_outline,
      ),
      TonoAviso.peligro => (
        colores.peligroSuave,
        colores.peligro,
        Icons.error_outline,
      ),
      TonoAviso.primario => (
        colores.primarioSuave,
        colores.primario,
        Icons.check_circle_outline,
      ),
    };
    return Container(
      padding: EdgeInsets.all(tokens.espacio.l),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(tokens.radio.l),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono ?? iconoFinal, color: color, size: tokens.tamano.iconoNav),
          SizedBox(width: tokens.espacio.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (titulo != null) ...[
                  Text(
                    titulo!,
                    style: textos.titleMedium?.copyWith(color: color),
                  ),
                  SizedBox(height: tokens.espacio.xs),
                ],
                Text(texto, style: textos.bodyLarge?.copyWith(color: color)),
                if (detalle != null) ...[
                  SizedBox(height: tokens.espacio.xs),
                  detalle!,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
