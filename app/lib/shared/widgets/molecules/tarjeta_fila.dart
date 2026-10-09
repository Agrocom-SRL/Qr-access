import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:flutter/material.dart';

/// Fila de listado en tarjeta (compacto y medio): algo a la izquierda
/// (ícono, avatar o barra de color), título, subtítulo y lo de la derecha
/// (badge, hora, chevron), con un pie opcional (acciones).
class TarjetaFila extends StatelessWidget {
  const new({
    required this.titulo,
    this.subtitulo,
    this.subtituloWidget,
    this.inicio,
    this.fin,
    this.pie,
    this.alTocar,
    this.barraColor,
    super.key,
  });

  final String titulo;
  final String? subtitulo;
  final Widget? subtituloWidget;
  final Widget? inicio;
  final Widget? fin;

  /// Acciones debajo de un separador (p. ej. "Anular").
  final Widget? pie;
  final VoidCallback? alTocar;

  /// Barra vertical de 4 dp a la izquierda (resultado de un evento).
  final Color? barraColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final cuerpo = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (barraColor != null) ...[
          Container(
            width: tokens.tamano.barraResultado,
            height: tokens.tamano.iconoCaja,
            decoration: BoxDecoration(
              color: barraColor,
              borderRadius: BorderRadius.circular(tokens.radio.s),
            ),
          ),
          SizedBox(width: tokens.espacio.m),
        ],
        if (inicio != null) ...[inicio!, SizedBox(width: tokens.espacio.m)],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: textos.titleMedium),
              if (subtituloWidget != null) ...[
                SizedBox(height: tokens.espacio.xxs),
                subtituloWidget!,
              ] else if (subtitulo != null) ...[
                SizedBox(height: tokens.espacio.xxs),
                Text(
                  subtitulo!,
                  style: textos.bodyMedium?.copyWith(
                    color: tokens.colores.textoSecundario,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (fin != null) ...[SizedBox(width: tokens.espacio.m), fin!],
      ],
    );
    return AccesoTarjeta(
      alTocar: alTocar,
      child: pie == null
          ? cuerpo
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                cuerpo,
                SizedBox(height: tokens.espacio.m),
                const Divider(),
                SizedBox(height: tokens.espacio.s),
                pie!,
              ],
            ),
    );
  }
}
