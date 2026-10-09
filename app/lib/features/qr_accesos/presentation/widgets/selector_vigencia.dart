import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:flutter/material.dart';

/// Vigencia del QR: por defecto el fin del día; la persona puede acortarla
/// (ADR 0008). Nunca supera la del plan: eso lo cumple la API.
class SelectorVigencia extends StatelessWidget {
  const new({required this.seleccionada, required this.alElegir, super.key});

  final OpcionVigencia seleccionada;
  final ValueChanged<OpcionVigencia> alElegir;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.qrEmitirVigencia,
          style: Theme.of(context).textTheme.labelLarge,
        ),
        SizedBox(height: tokens.espacio.s),
        SegmentedButton<OpcionVigencia>(
          segments: [
            for (final opcion in OpcionVigencia.values)
              ButtonSegment(value: opcion, label: Text(_texto(l10n, opcion))),
          ],
          selected: {seleccionada},
          onSelectionChanged: (elegidas) => alElegir(elegidas.first),
        ),
      ],
    );
  }

  String _texto(AppLocalizations l10n, OpcionVigencia opcion) =>
      switch (opcion) {
        OpcionVigencia.finDelDia => l10n.qrVigenciaFinDelDia,
        OpcionVigencia.unaHora => l10n.qrVigenciaUnaHora,
        OpcionVigencia.cuatroHoras => l10n.qrVigenciaCuatroHoras,
      };
}
