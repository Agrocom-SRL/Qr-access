import 'package:dio/dio.dart';

/// Error de la API ya leído. Lleva el `code` estable del formato RFC 9457
/// (ADR 0005): la app lo traduce a un texto del ARB en `mensaje_error.dart`
/// y nunca interpreta el mensaje de la API ni las excepciones de dio.
class ErrorApi implements Exception {
  const new({required this.code, this.status});

  /// Lee el `code` del cuerpo `application/problem+json`. Sin respuesta, es
  /// un error de red; sin un cuerpo con `code`, queda como `desconocido`.
  new desde(DioException e)
    : code = _codigoDe(e),
      status = e.response?.statusCode;

  /// Código local cuando no hubo respuesta de la API (sin red o sin tiempo).
  static const sinConexion = 'red.sin_conexion';

  /// Código cuando no llega un cuerpo RFC 9457 válido.
  static const desconocido = 'desconocido';

  final String code;
  final int? status;

  bool get esSinConexion => code == sinConexion;

  @override
  String toString() => 'ErrorApi($code, $status)';
}

String _codigoDe(DioException e) {
  final respuesta = e.response;
  if (respuesta == null) return ErrorApi.sinConexion;
  final cuerpo = respuesta.data;
  final code = cuerpo is Map<String, dynamic> ? cuerpo['code'] : null;
  return code is String && code.isNotEmpty ? code : ErrorApi.desconocido;
}
