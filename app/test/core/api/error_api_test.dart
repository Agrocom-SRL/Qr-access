import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

DioException _respuesta(int status, Object? cuerpo) => DioException(
  requestOptions: RequestOptions(path: '/x'),
  response: Response<Object?>(
    requestOptions: RequestOptions(path: '/x'),
    statusCode: status,
    data: cuerpo,
  ),
);

DioException _sinRespuesta() => DioException.connectionError(
  requestOptions: RequestOptions(path: '/x'),
  reason: 'sin red',
);

void main() {
  group('ErrorApi.desde', () {
    test('toma el code del cuerpo RFC 9457', () {
      final error = ErrorApi.desde(
        _respuesta(409, {
          'type': 'https://acceso.agrocom.com.bo/errores/qr.ya_usado',
          'code': 'qr.ya_usado',
          'status': 409,
        }),
      );
      expect(error.code, 'qr.ya_usado');
      expect(error.status, 409);
    });

    test('sin respuesta, el error es de conexión', () {
      final error = ErrorApi.desde(_sinRespuesta());
      expect(error.code, ErrorApi.sinConexion);
      expect(error.esSinConexion, isTrue);
      expect(error.status, isNull);
    });

    test('un cuerpo sin code queda como desconocido, no como texto crudo', () {
      final error = ErrorApi.desde(_respuesta(502, '<html>mal</html>'));
      expect(error.code, ErrorApi.desconocido);
      expect(error.status, 502);
    });
  });

  group('textoDeError', () {
    late final textos = textosDe();

    test('traduce el code de sesión por el ARB', () async {
      final l10n = await textos;
      const error = ErrorApi(
        code: 'sesion.credenciales_invalidas',
        status: 401,
      );
      expect(
        textoDeError(l10n, error),
        l10n.comunErrorSesionCredencialesInvalidas,
      );
    });

    test('traduce la falta de conexión', () async {
      final l10n = await textos;
      expect(
        textoDeError(l10n, const ErrorApi(code: ErrorApi.sinConexion)),
        l10n.comunErrorSinConexion,
      );
    });

    test('un code sin traducción muestra el mensaje genérico', () async {
      final l10n = await textos;
      expect(
        textoDeError(l10n, const ErrorApi(code: 'algo.nuevo', status: 500)),
        l10n.comunErrorGenerico,
      );
    });

    test('cualquier error que no sea de la API muestra el genérico', () async {
      final l10n = await textos;
      expect(textoDeError(l10n, StateError('x')), l10n.comunErrorGenerico);
    });
  });
}
