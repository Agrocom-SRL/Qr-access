import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:flutter/material.dart';

/// Paso 1 (handoff C05a/E05): selección múltiple agrupada por sitio con
/// "Todas"; las puertas sin conexión se pueden elegir y se marcan.
class PasoPuertas extends StatelessWidget {
  const new({
    required this.puertas,
    required this.seleccionadas,
    required this.alAlternar,
    required this.alAlternarTodas,
    super.key,
  });

  final List<Puerta> puertas;
  final Set<String> seleccionadas;
  final ValueChanged<String> alAlternar;
  final ValueChanged<Iterable<String>> alAlternarTodas;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final textos = Theme.of(context).textTheme;
    final grupos = agruparPorSitio(puertas);
    final expandida = context.esExpandida;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.qrEmitirPregunta,
          style: textos.bodyLarge?.copyWith(
            color: tokens.colores.textoSecundario,
          ),
        ),
        SizedBox(height: tokens.espacio.l),
        for (final MapEntry(key: sitio, value: delSitio) in grupos.entries) ...[
          Row(
            children: [
              Expanded(
                child: Text(
                  sitio.toUpperCase(),
                  style: textos.labelSmall?.copyWith(
                    color: tokens.colores.textoSecundario,
                    letterSpacing: tokens.espacio.xxs / 2,
                  ),
                ),
              ),
              AccesoBoton(
                texto: expandida
                    ? l10n.qrEmitirSeleccionarTodas
                    : l10n.qrEmitirTodas,
                variante: VarianteBoton.texto,
                onPressed: () => alAlternarTodas(delSitio.map((p) => p.id)),
              ),
            ],
          ),
          SizedBox(height: tokens.espacio.xs),
          if (expandida)
            Wrap(
              spacing: tokens.espacio.l,
              runSpacing: tokens.espacio.l,
              children: [
                for (final puerta in delSitio)
                  SizedBox(
                    width: tokens.tamano.railExpandido - tokens.espacio.xl,
                    child: _Opcion(
                      puerta: puerta,
                      elegida: seleccionadas.contains(puerta.id),
                      alAlternar: () => alAlternar(puerta.id),
                      enTarjeta: true,
                    ),
                  ),
              ],
            )
          else
            AccesoTarjeta(
              relleno: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < delSitio.length; i++) ...[
                    _Opcion(
                      puerta: delSitio[i],
                      elegida: seleccionadas.contains(delSitio[i].id),
                      alAlternar: () => alAlternar(delSitio[i].id),
                      enTarjeta: false,
                    ),
                    if (i < delSitio.length - 1) const Divider(),
                  ],
                ],
              ),
            ),
          SizedBox(height: tokens.espacio.xl),
        ],
      ],
    );
  }
}

class _Opcion extends StatelessWidget {
  const new({
    required this.puerta,
    required this.elegida,
    required this.alAlternar,
    required this.enTarjeta,
  });

  final Puerta puerta;
  final bool elegida;
  final VoidCallback alAlternar;
  final bool enTarjeta;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final sinConexion = Text(
      context.l10n.puertaSinConexion,
      style: textos.bodySmall?.copyWith(color: colores.peligro),
    );
    final fila = Semantics(
      checked: elegida,
      label: puerta.nombre,
      child: InkWell(
        onTap: alAlternar,
        borderRadius: BorderRadius.circular(tokens.radio.l),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: tokens.espacio.l,
            vertical: tokens.espacio.m,
          ),
          child: Row(
            children: [
              ExcludeSemantics(
                child: Checkbox(value: elegida, onChanged: (_) => alAlternar()),
              ),
              SizedBox(width: tokens.espacio.s),
              Expanded(
                child: enTarjeta
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(puerta.nombre, style: textos.bodyLarge),
                          if (puerta.sinConexion) sinConexion,
                        ],
                      )
                    : Text(puerta.nombre, style: textos.bodyLarge),
              ),
              if (!enTarjeta && puerta.sinConexion) sinConexion,
            ],
          ),
        ),
      ),
    );
    if (!enTarjeta) {
      return ColoredBox(
        color: elegida ? colores.primarioSuave : colores.superficie,
        child: fila,
      );
    }
    return AccesoTarjeta(
      relleno: EdgeInsets.zero,
      seleccionada: elegida,
      color: elegida ? colores.primarioSuave : null,
      child: fila,
    );
  }
}
