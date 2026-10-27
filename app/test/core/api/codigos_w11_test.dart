import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// Los textos se miran en español, que es la plantilla del ARB.
final Future<AppLocalizations> _l10nFuture = AppLocalizations.delegate.load(
  const Locale('es'),
);

void main() {
  late AppLocalizations l10n;

  setUpAll(() async => l10n = await _l10nFuture);

  group('códigos de incidentes, anulación y exportación (ADR 0033)', () {
    final casos = <String, String Function(AppLocalizations)>{
      'incidente.no_encontrado': (l) => l.comunErrorIncidenteNoEncontrado,
      'incidente.propio': (l) => l.comunErrorIncidentePropio,
      'incidente.motivo_requerido': (l) => l.comunErrorIncidenteMotivoRequerido,
      'incidente.evidencia_invalida': (l) =>
          l.comunErrorIncidenteEvidenciaInvalida,
      'incidente.fecha_futura': (l) => l.comunErrorIncidenteFechaFutura,
      'incidente.fecha_antigua': (l) => l.comunErrorIncidenteFechaAntigua,
      'incidente.tope_diario': (l) => l.comunErrorIncidenteTopeDiario,
      'anulacion.alcance_no_permitido': (l) =>
          l.comunErrorAnulacionAlcanceNoPermitido,
      'exportacion.tope_excedido': (l) => l.comunErrorExportacionTopeExcedido,
      'limite.excedido': (l) => l.comunErrorLimiteExcedido,
    };

    for (final entrada in casos.entries) {
      test('${entrada.key} se traduce, no cae en el genérico', () {
        final texto = textoDeError(
          l10n,
          ErrorApi(code: entrada.key, status: 422),
        );

        expect(texto, entrada.value(l10n));
        expect(texto, isNot(l10n.comunErrorGenerico));
      });
    }
  });

  group('motivo de estado incidente.reincidencia:<id>', () {
    test('con un id, el texto nombra ese incidente como parámetro', () {
      expect(
        textoDeMotivoDeEstado(l10n, 'incidente.reincidencia:412'),
        l10n.comunMotivoIncidenteReincidencia('412'),
      );
      expect(
        textoDeMotivoDeEstado(l10n, 'incidente.reincidencia:412'),
        contains('412'),
      );
    });

    test('un id que no son solo dígitos no entra en el texto', () {
      final texto = textoDeMotivoDeEstado(
        l10n,
        'incidente.reincidencia:<script>',
      );

      expect(texto, l10n.comunMotivoIncidenteReincidenciaSinId);
      expect(texto, isNot(contains('script')));
    });

    test('sin id, dice la reincidencia sin nombrar nada', () {
      expect(
        textoDeMotivoDeEstado(l10n, 'incidente.reincidencia'),
        l10n.comunMotivoIncidenteReincidenciaSinId,
      );
    });

    test('otro motivo se traduce como un código de error', () {
      expect(
        textoDeMotivoDeEstado(l10n, 'qr.ya_usado'),
        l10n.comunErrorQrYaUsado,
      );
      expect(
        textoDeMotivoDeEstado(l10n, 'codigo.raro'),
        l10n.comunErrorGenerico,
      );
    });
  });
}
