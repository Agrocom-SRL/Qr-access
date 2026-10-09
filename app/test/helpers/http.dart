import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Respuesta JSON con el tipo `application/problem+json` cuando es un error.
ResponseBody respuestaJson(int status, Map<String, Object?> cuerpo) =>
    ResponseBody.fromString(
      jsonEncode(cuerpo),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

/// Adaptador HTTP de prueba: responde con lo que decida `responder` y guarda
/// cada petición que recibió.
class AdaptadorHttpFalso implements HttpClientAdapter {
  new(this.responder);

  final Future<ResponseBody> Function(RequestOptions options) responder;
  final List<RequestOptions> peticiones = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    peticiones.add(options);
    return responder(options);
  }

  @override
  void close({bool force = false}) {}
}
