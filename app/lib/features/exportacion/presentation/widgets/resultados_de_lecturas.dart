import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/pestanas_deslizables.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:flutter/material.dart';

/// El resultado de los accesos que se bajan: Todos, Permitido o Rechazado.
/// Usa las pestañas que se deslizan del proyecto. Cada pestaña dice qué baja;
/// cambiar de pestaña no baja nada.
class ResultadosDeLecturas extends StatelessWidget {
  const new({
    required this.seleccionado,
    required this.bloqueado,
    required this.alElegir,
    super.key,
  });

  final ResultadoFiltro seleccionado;

  /// Con una descarga en curso, no se cambia.
  final bool bloqueado;
  final ValueChanged<ResultadoFiltro> alElegir;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return PestanasDeslizables<ResultadoFiltro>(
      segmentos: [
        SegmentoDeSelector(
          valor: ResultadoFiltro.todos,
          etiqueta: l10n.exportacionTodos,
        ),
        SegmentoDeSelector(
          valor: ResultadoFiltro.permitido,
          etiqueta: l10n.exportacionPermitido,
        ),
        SegmentoDeSelector(
          valor: ResultadoFiltro.rechazado,
          etiqueta: l10n.exportacionRechazado,
        ),
      ],
      seleccionado: seleccionado,
      alElegir: bloqueado ? (_) {} : alElegir,
      paginaDe: (contexto, valor) => Padding(
        padding: EdgeInsets.all(tokens.espacio.l),
        child: Text(
          _explicacion(l10n, valor),
          style: textos.bodyMedium?.copyWith(
            color: tokens.colores.textoSecundario,
          ),
        ),
      ),
    );
  }

  static String _explicacion(AppLocalizations l10n, ResultadoFiltro valor) =>
      switch (valor) {
        ResultadoFiltro.todos => l10n.exportacionResultadoTodosAyuda,
        ResultadoFiltro.permitido => l10n.exportacionResultadoPermitidoAyuda,
        ResultadoFiltro.rechazado => l10n.exportacionResultadoRechazadoAyuda,
      };
}
