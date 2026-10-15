import 'dart:convert';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_cache_contrato.dart';
import 'package:dio/dio.dart';

/// Quién es la persona que consulta, o `null` si no hay sesión. Separa la
/// caché por usuario y rol: lo que ve un rol no se le muestra a otro.
typedef AmbitoDeCache = String? Function();

/// Modo sin conexión: guarda cada lectura (GET) buena y, si el servidor no
/// responde, entrega la última guardada del mismo recurso.
///
/// Solo lecturas: una escritura sin red falla como siempre, y la puerta nunca
/// abre por lo guardado aquí (invariante 2). Los datos de una cuenta no se
/// mezclan con los de otra porque la clave lleva el usuario y el rol, y la
/// caché se vacía al cerrar la sesión.
class InterceptorCache extends Interceptor {
  new(
    this._almacen,
    this._ambito, {
    required this.alServirGuardado,
    required this.alRecibirDatosVivos,
  });

  final AlmacenCache _almacen;
  final AmbitoDeCache _ambito;

  /// Se llama con la hora en que se guardaron los datos que se están mostrando.
  final void Function(DateTime guardadoAt) alServirGuardado;

  /// Se llama cuando el servidor respondió: ya no se muestran datos viejos.
  final void Function() alRecibirDatosVivos;

  @override
  Future<void> onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) async {
    final clave = _clave(response.requestOptions);
    if (clave != null) {
      alRecibirDatosVivos();
      final datos = response.data;
      if (datos is Map<String, dynamic> || datos is List<dynamic>) {
        try {
          await _almacen.guardar(clave, jsonEncode(datos));
        } on Object {
          // La caché es una comodidad: si falla, la respuesta llega igual.
        }
      }
    }
    handler.next(response);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final clave = _clave(err.requestOptions);
    if (clave == null || !ErrorApi.desde(err).esSinConexion) {
      return handler.next(err);
    }
    try {
      final entrada = await _almacen.leer(clave);
      if (entrada != null) {
        alServirGuardado(entrada.guardadoAt);
        return handler.resolve(
          Response<dynamic>(
            requestOptions: err.requestOptions,
            statusCode: 200,
            data: jsonDecode(entrada.cuerpo),
          ),
        );
      }
    } on Object {
      // Caché ilegible: se entrega el error de red original.
    }
    handler.next(err);
  }

  /// La clave de una lectura con sesión, o `null` si no se guarda (otro
  /// método, petición sin sesión o nadie ha ingresado).
  String? _clave(RequestOptions solicitud) {
    final ambito = _ambito();
    if (ambito == null || solicitud.method != 'GET' || solicitud.sinSesion) {
      return null;
    }
    final consulta = solicitud.uri.queryParameters;
    final orden = consulta.keys.toList()..sort();
    return '$ambito|${solicitud.uri.path}?'
        '${orden.map((k) => '$k=${consulta[k]}').join('&')}';
  }
}
