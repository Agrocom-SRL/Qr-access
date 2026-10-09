import 'package:agrocom_acceso/core/api/contratos/comunes.dart';
import 'package:agrocom_acceso/core/api/contratos/eventos_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/qr_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/usuarios_contratos.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:dio/dio.dart';

/// Filtros de `GET /eventos-acceso` y de su resumen.
class FiltroEventosApi {
  const new({this.resultado, this.puertaId, this.desde, this.hasta});

  /// `permitido`, `rechazado` o `null` para todos.
  final String? resultado;
  final String? puertaId;
  final DateTime? desde;
  final DateTime? hasta;

  Map<String, Object> aQuery() => {
    'resultado': ?resultado,
    'puerta_id': ?puertaId,
    'desde': ?desde?.toUtc().toIso8601String(),
    'hasta': ?hasta?.toUtc().toIso8601String(),
  };
}

/// Cliente de la API V1 (contrato común V1, ADR 0005). Cada método es un
/// endpoint; devuelve contratos tipados y lanza [ErrorApi] ante cualquier
/// fallo. Las features lo usan solo desde sus repositorios.
class ClienteApi {
  new(this._dio);

  final Dio _dio;

  /// Opciones de las peticiones que no llevan acceso (login y refresco).
  static final _sinSesion = Options(extra: {claveSinSesion: true});

  Future<RespuestaInicioDto> iniciarSesion(String pin) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/sesiones',
        data: {'pin': pin},
        options: _sinSesion,
      );
      return RespuestaInicioDto.desde(r.data!);
    });
  }

  Future<TokensDto> refrescar(String refresco) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/sesiones/refresco',
        data: {'refresco': refresco},
        options: _sinSesion,
      );
      return TokensDto.desde(r.data!);
    });
  }

  /// Devuelve el acceso nuevo del rol elegido.
  Future<String> cambiarRolActivo(String rolId) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/sesiones/rol-activo',
        data: {'rol_id': rolId},
      );
      return r.data!['acceso'] as String;
    });
  }

  Future<SesionActualDto> sesionActual() {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>('/sesiones/actual');
      return SesionActualDto.desde(r.data!);
    });
  }

  Future<void> cerrarSesion() {
    return _ejecutar(() async {
      await _dio.delete<void>('/sesiones/actual');
    });
  }

  Future<PaginaDto<PuertaDto>> puertas({
    required int pagina,
    required int porPagina,
  }) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/puertas',
        queryParameters: {'pagina': pagina, 'por_pagina': porPagina},
      );
      return paginaDeApi(r.data!, PuertaDto.desde);
    });
  }

  /// `venceAt` y `etiqueta` van solo si el usuario los eligió; sin ellos, la
  /// API calcula el fin del día local del sitio (ADR 0008).
  Future<QrEmitidoDto> emitirQr({
    required List<String> puertaIds,
    DateTime? venceAt,
    String? etiqueta,
  }) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/qr-accesos',
        data: {
          'puerta_ids': puertaIds,
          'vence_at': ?venceAt?.toUtc().toIso8601String(),
          'etiqueta': ?etiqueta,
        },
      );
      return QrEmitidoDto.desde(r.data!);
    });
  }

  Future<PaginaDto<QrAccesoDto>> qrAccesos({
    required String estado,
    required int pagina,
    required int porPagina,
  }) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/qr-accesos',
        queryParameters: {
          'estado': estado,
          'pagina': pagina,
          'por_pagina': porPagina,
        },
      );
      return paginaDeApi(r.data!, QrAccesoDto.desde);
    });
  }

  Future<ResumenQrDto> resumenQr() {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>('/qr-accesos/resumen');
      return ResumenQrDto.desde(r.data!);
    });
  }

  Future<void> anularQr(String id) {
    return _ejecutar(() async {
      await _dio.post<void>('/qr-accesos/$id/anulacion');
    });
  }

  Future<PaginaDto<EventoAccesoDto>> eventosAcceso({
    required int pagina,
    required int porPagina,
    FiltroEventosApi filtro = const FiltroEventosApi(),
  }) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/eventos-acceso',
        queryParameters: {
          'pagina': pagina,
          'por_pagina': porPagina,
          ...filtro.aQuery(),
        },
      );
      return paginaDeApi(r.data!, EventoAccesoDto.desde);
    });
  }

  Future<ResumenEventosDto> resumenEventos(FiltroEventosApi filtro) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/eventos-acceso/resumen',
        queryParameters: filtro.aQuery(),
      );
      return ResumenEventosDto.desde(r.data!);
    });
  }

  Future<PaginaDto<UsuarioAdminDto>> usuarios({
    required int pagina,
    required int porPagina,
  }) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/usuarios',
        queryParameters: {'pagina': pagina, 'por_pagina': porPagina},
      );
      return paginaDeApi(r.data!, UsuarioAdminDto.desde);
    });
  }

  Future<List<RolDto>> roles() {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>('/roles');
      return [
        for (final rol in r.data!['datos'] as List<dynamic>)
          RolDto.desde(rol as Map<String, dynamic>),
      ];
    });
  }

  /// El PIN del usuario nuevo llega solo acá (ADR 0018 §3).
  Future<UsuarioCreadoDto> crearUsuario({
    required String etiqueta,
    required List<String> rolIds,
  }) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/usuarios',
        data: {'etiqueta': etiqueta, 'rol_ids': rolIds},
      );
      return UsuarioCreadoDto.desde(r.data!);
    });
  }

  Future<UsuarioAdminDto> editarUsuario(
    String id, {
    String? etiqueta,
    List<String>? rolIds,
  }) {
    return _ejecutar(() async {
      final r = await _dio.patch<Map<String, dynamic>>(
        '/usuarios/$id',
        data: {'etiqueta': ?etiqueta, 'rol_ids': ?rolIds},
      );
      return UsuarioAdminDto.desde(r.data!);
    });
  }

  Future<void> eliminarUsuario(String id) {
    return _ejecutar(() async {
      await _dio.delete<void>('/usuarios/$id');
    });
  }

  Future<PinGeneradoDto> generarPin(String usuarioId) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/usuarios/$usuarioId/pin',
      );
      return PinGeneradoDto.desde(r.data!);
    });
  }

  /// Traduce cualquier fallo de dio a [ErrorApi] para que nadie fuera de
  /// `core/api` vea excepciones de la librería.
  Future<T> _ejecutar<T>(Future<T> Function() peticion) async {
    try {
      return await peticion();
    } on DioException catch (e) {
      throw ErrorApi.desde(e);
    }
  }
}
