import 'package:dio/dio.dart';

/// Error de la API ya leído. Lleva el `code` estable del formato RFC 9457
/// (ADR 0005): la app lo traduce a un texto del ARB en `mensaje_error.dart`
/// y nunca interpreta el mensaje de la API ni las excepciones de dio.
class ErrorApi implements Exception {
  const new({required this.code, this.status, this.detalles = const {}});

  /// Lee el `code` del cuerpo `application/problem+json`. Sin respuesta, es
  /// un error de red; sin un cuerpo con `code`, queda como `desconocido`.
  new desde(DioException e)
    : code = _codigoDe(e),
      status = e.response?.statusCode,
      detalles = _detallesDe(e);

  /// Código local cuando no hubo respuesta de la API (sin red o sin tiempo).
  static const sinConexion = 'red.sin_conexion';

  /// Código cuando no llega un cuerpo RFC 9457 válido.
  static const desconocido = 'desconocido';

  final String code;
  final int? status;

  /// Campos extra del problema (p. ej. `reintentar_en_segundos` del bloqueo).
  final Map<String, Object?> detalles;

  bool get esSinConexion => code == sinConexion;

  /// Segundos de espera que manda `sesion.bloqueada`; `null` si no vienen.
  int? get reintentarEnSegundos => switch (detalles['reintentar_en_segundos']) {
    final int segundos => segundos,
    final num segundos => segundos.toInt(),
    _ => null,
  };

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

Map<String, Object?> _detallesDe(DioException e) {
  final cuerpo = e.response?.data;
  if (cuerpo is! Map<String, dynamic>) return const {};
  return {
    for (final MapEntry(:key, :value) in cuerpo.entries)
      if (!const {'type', 'title', 'status', 'code'}.contains(key)) key: value,
  };
}
