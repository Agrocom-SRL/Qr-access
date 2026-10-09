import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:flutter/material.dart';

/// Tarjeta con radio (elegir rol, vigencia): borde 2 dp primario al elegirla.
class TarjetaSeleccionable extends StatelessWidget {
  const new({
    required this.titulo,
    required this.seleccionada,
    required this.alElegir,
    this.subtitulo,
    this.icono,
    this.etiquetaDerecha,
    this.child,
    super.key,
  });

  final String titulo;
  final String? subtitulo;
  final IconData? icono;
  final bool seleccionada;
  final VoidCallback alElegir;

  /// Badge o texto a la derecha del título ("Por defecto").
  final Widget? etiquetaDerecha;

  /// Contenido extra debajo (las pastillas de "Más corto").
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      selected: seleccionada,
      child: AccesoTarjeta(
        seleccionada: seleccionada,
        alTocar: alElegir,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (icono != null) ...[
                  CajaIcono(icono: icono!),
                  SizedBox(width: tokens.espacio.l),
                ] else ...[
                  _Radio(seleccionado: seleccionada),
                  SizedBox(width: tokens.espacio.l),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(titulo, style: textos.titleMedium),
                      if (subtitulo != null)
                        Text(
                          subtitulo!,
                          style: textos.bodyMedium?.copyWith(
                            color: tokens.colores.textoSecundario,
                          ),
                        ),
                    ],
                  ),
                ),
                if (etiquetaDerecha != null) ...[
                  SizedBox(width: tokens.espacio.s),
                  etiquetaDerecha!,
                ],
                if (icono != null) ...[
                  SizedBox(width: tokens.espacio.s),
                  _Radio(seleccionado: seleccionada),
                ],
              ],
            ),
            if (child != null) ...[SizedBox(height: tokens.espacio.m), child!],
          ],
        ),
      ),
    );
  }
}

class _Radio extends StatelessWidget {
  const new({required this.seleccionado});

  final bool seleccionado;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final lado = tokens.tamano.iconoNav;
    return ExcludeSemantics(
      child: AnimatedContainer(
        duration: tokens.duracion.efectiva(context, tokens.duracion.rapida),
        width: lado,
        height: lado,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: seleccionado ? colores.primario : colores.textoSecundario,
            width: tokens.tamano.bordeFoco,
          ),
        ),
        padding: EdgeInsets.all(tokens.espacio.xs),
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: seleccionado ? colores.primario : null,
          ),
        ),
      ),
    );
  }
}
