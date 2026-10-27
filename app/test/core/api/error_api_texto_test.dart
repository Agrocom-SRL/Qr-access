import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

DioException _respuestaDeTexto(int status, String cuerpo) => DioException(
  requestOptions: RequestOptions(path: '/exportaciones/usuarios'),
  response: Response<String>(
    requestOptions: RequestOptions(path: '/exportaciones/usuarios'),
    statusCode: status,
    data: cuerpo,
  ),
);

/// La exportación pide el CSV como texto (`ResponseType.plain`), así que el
/// error también llega como texto: hay que leer su `code` igual que el JSON.
void main() {
  test('lee el code de un problema que llega como texto JSON', () {
    final error = ErrorApi.desde(
      _respuestaDeTexto(
        422,
        '{"type":"https://acceso.agrocom.com.bo/errores/exportacion.tope_excedido",'
        '"code":"exportacion.tope_excedido","status":422}',
      ),
    );

    expect(error.code, 'exportacion.tope_excedido');
    expect(error.status, 422);
  });

  test('sin el code en el texto, el error queda como desconocido', () {
    final error = ErrorApi.desde(_respuestaDeTexto(500, 'Internal Server'));

    expect(error.code, ErrorApi.desconocido);
  });

  test('un texto que no es JSON no revienta', () {
    final error = ErrorApi.desde(_respuestaDeTexto(502, '<html>'));

    expect(error.code, ErrorApi.desconocido);
    expect(error.detalles, isEmpty);
  });

  test('los campos extra del problema viajan, sin los de RFC 9457', () {
    final error = ErrorApi.desde(
      _respuestaDeTexto(
        429,
        '{"code":"limite.excedido","status":429,"reintentar_en_segundos":30}',
      ),
    );

    expect(error.detalles, {'reintentar_en_segundos': 30});
  });
}
