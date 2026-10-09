import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/features/eventos/presentation/evento_vista.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:flutter/material.dart';

/// Un evento en tarjeta (handoff C08): barra de color del resultado, puerta,
/// detalle, badge y hora sin segundos.
class TarjetaEvento extends StatelessWidget {
  const new({required this.evento, super.key});

  final EventoAcceso evento;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    return TarjetaFila(
      titulo: evento.puertaNombre,
      subtitulo: textoDetalleEvento(l10n, evento),
      barraColor: evento.esPermitido
          ? colores.accesoPermitido
          : colores.accesoDenegado,
      fin: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          AccesoBadge(
            texto: textoResultadoEvento(l10n, evento.resultado),
            tono: tonoResultadoEvento(evento.resultado),
          ),
          SizedBox(height: tokens.espacio.xs),
          Text(
            formatearHora(evento.ocurridoAt),
            style: tokens.tipografia.mono(
              tokens.tipografia.t14,
              color: colores.textoSecundario,
            ),
          ),
        ],
      ),
    );
  }
}

/// Un evento en una fila compacta del tablero (handoff C04b): hora, puerta,
/// detalle y badge.
class FilaEvento extends StatelessWidget {
  const new({required this.evento, super.key});

  final EventoAcceso evento;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: tokens.espacio.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: tokens.tamano.columnaHora - tokens.espacio.xl,
            child: Text(
              formatearHora(evento.ocurridoAt),
              style: tokens.tipografia.mono(
                tokens.tipografia.t14,
                color: tokens.colores.textoSecundario,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(evento.puertaNombre, style: textos.titleMedium),
                Text(
                  textoDetalleEvento(l10n, evento),
                  style: textos.bodyMedium?.copyWith(
                    color: tokens.colores.textoSecundario,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: tokens.espacio.m),
          AccesoBadge(
            texto: textoResultadoEvento(l10n, evento.resultado),
            tono: tonoResultadoEvento(evento.resultado),
          ),
        ],
      ),
    );
  }
}
