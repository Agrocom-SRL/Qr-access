import 'package:dio/dio.dart';

/// Lo que el interceptor necesita de la sesión. Lo implementa
/// `SesionControlador`; `core/api` no conoce la sesión, solo este contrato.
abstract interface class ProveedorTokens {
  /// Acceso vigente, o `null` si no hay sesión.
  String? get acceso;

  /// Pide un par nuevo con el refresco guardado y lo adopta. Devuelve `false`
  /// si la sesión no se puede recuperar (ADR 0018: sesión de corta vida).
  Future<bool> renovar();
}

/// Marca una petición que no lleva acceso ni se renueva al fallar (login y
/// refresco). Va en `Options.extra`.
const claveSinSesion = 'sinSesion';

/// Marca una petición que ya se reintentó tras renovar: si vuelve a fallar
/// con 401, se entrega el error sin otro refresco (evita bucles).
const claveReintento = 'reintento';

extension SolicitudSinSesion on RequestOptions {
  bool get sinSesion => extra[claveSinSesion] == true;
}

/// Adjunta el JWT a cada petición y, ante un 401, renueva la sesión una sola
/// vez aunque lleguen varios 401 a la vez (refresco rotativo, ADR 0004).
class InterceptorSesion extends Interceptor {
  new(this._tokens, this._dio);

  final ProveedorTokens _tokens;
  final Dio _dio;

  /// Renovación en curso compartida: si el refresco rota, dos renovaciones
  /// simultáneas invalidarían el refresco una de otra.
  Future<bool>? _renovacion;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final acceso = _tokens.acceso;
    if (!options.sinSesion && acceso != null) {
      options.headers['Authorization'] = 'Bearer $acceso';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (!_debeRenovar(err)) return handler.next(err);

    final renovado = await (_renovacion ??= _renovar());
    if (!renovado) return handler.next(err);

    final solicitud = err.requestOptions..extra[claveReintento] = true;
    try {
      handler.resolve(await _dio.fetch<dynamic>(solicitud));
    } on DioException catch (reintento) {
      handler.next(reintento);
    }
  }

  bool _debeRenovar(DioException err) {
    final solicitud = err.requestOptions;
    return err.response?.statusCode == 401 &&
        !solicitud.sinSesion &&
        solicitud.extra[claveReintento] != true;
  }

  Future<bool> _renovar() async {
    try {
      return await _tokens.renovar();
    } finally {
      _renovacion = null;
    }
  }
}
