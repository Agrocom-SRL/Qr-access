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

  group('códigos de generación de QR (ADR 0030 y 0031)', () {
    final casos = <String, String Function(AppLocalizations)>{
      'qr.limite_diario': (l) => l.comunErrorQrLimiteDiario,
      'qr.limite_pendientes': (l) => l.comunErrorQrLimitePendientes,
      'qr.limite_puertas': (l) => l.comunErrorQrLimitePuertas,
      'qr.generacion_restringida': (l) => l.comunErrorQrGeneracionRestringida,
      'qr.generador_suspendido': (l) => l.comunErrorQrGeneradorSuspendido,
      'qr.cuenta_suspendida': (l) => l.comunErrorQrCuentaSuspendida,
      'sesion.usuario_suspendido': (l) => l.comunErrorSesionUsuarioSuspendido,
      'sesion.cuenta_suspendida': (l) => l.comunErrorSesionCuentaSuspendida,
      'idempotencia.conflicto': (l) => l.comunErrorIdempotenciaConflicto,
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

  group('qr.limite_propios_sin_uso', () {
    test('con una espera corta dice los minutos que faltan', () {
      const error = ErrorApi(
        code: 'qr.limite_propios_sin_uso',
        status: 429,
        detalles: {'reintentar_en_segundos': 95},
      );

      // 95 s son dos minutos enteros hacia arriba: nunca se redondea a la baja.
      expect(
        textoDeError(l10n, error),
        l10n.comunErrorQrLimitePropiosEspera(2),
      );
    });

    test('con una espera de un minuto usa el singular', () {
      const error = ErrorApi(
        code: 'qr.limite_propios_sin_uso',
        status: 429,
        detalles: {'reintentar_en_segundos': 30},
      );

      expect(
        textoDeError(l10n, error),
        l10n.comunErrorQrLimitePropiosEspera(1),
      );
    });

    test('con la espera hasta el día siguiente no pone una cifra', () {
      const error = ErrorApi(
        code: 'qr.limite_propios_sin_uso',
        status: 429,
        detalles: {'reintentar_en_segundos': 36000},
      );

      expect(textoDeError(l10n, error), l10n.comunErrorQrLimitePropiosSinUso);
    });

    test('sin espera en el cuerpo, usa el texto del tope del día', () {
      const error = ErrorApi(code: 'qr.limite_propios_sin_uso', status: 429);

      expect(textoDeError(l10n, error), l10n.comunErrorQrLimitePropiosSinUso);
    });
  });
}
