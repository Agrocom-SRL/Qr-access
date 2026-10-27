import 'package:agrocom_acceso/core/api/contratos/comunes.dart';
import 'package:agrocom_acceso/core/api/contratos/estructura_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/eventos_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/qr_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/usuarios_contratos.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:dio/dio.dart';

/// Filtros de `GET /lecturas` y de su resumen.
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
  /// [reemplazar] pide otro QR propio aunque el vigente siga sin usar (la app
  /// perdió su token). Solo tiene efecto con [propio] (ADR 0030 §2.1.3).
  /// [idempotencyKey] va en la cabecera `Idempotency-Key`: un reintento con la
  /// misma clave y el mismo cuerpo recibe la misma respuesta (ADR 0031 §11).
  Future<QrGeneradoDto> generarQr({
    required List<String> puertaIds,
    DateTime? venceAt,
    String? etiqueta,
    bool propio = false,
    bool reemplazar = false,
    String? idempotencyKey,
  }) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/qr-accesos',
        data: {
          'puerta_ids': puertaIds,
          'vence_at': ?venceAt?.toUtc().toIso8601String(),
          'etiqueta': ?etiqueta,
          if (propio) 'propio': true,
          if (reemplazar) 'reemplazar': true,
        },
        options: idempotencyKey == null
            ? null
            : Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
      return QrGeneradoDto.desde(r.data!);
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

  Future<EstadoQrDto> estadoQr(String id) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>('/qr-accesos/$id/estado');
      return EstadoQrDto.desde(r.data!);
    });
  }

  Future<void> anularQr(String id) {
    return _ejecutar(() async {
      await _dio.post<void>('/qr-accesos/$id/anulacion');
    });
  }

  Future<PaginaDto<LecturaDto>> lecturas({
    required int pagina,
    required int porPagina,
    FiltroEventosApi filtro = const FiltroEventosApi(),
  }) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/lecturas',
        queryParameters: {
          'pagina': pagina,
          'por_pagina': porPagina,
          ...filtro.aQuery(),
        },
      );
      return paginaDeApi(r.data!, LecturaDto.desde);
    });
  }

  Future<ResumenEventosDto> resumenEventos(FiltroEventosApi filtro) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/lecturas/resumen',
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
  ///
  /// Un usuario tiene un solo rol (ADR 0028): `rol_ids` lleva exactamente uno.
  /// Un Titular lleva además su `unidad`.
  Future<UsuarioCreadoDto> crearUsuario({
    required String etiqueta,
    required String rolId,
    String? unidadSitioId,
    String? unidadNombre,
    String? sufijo,
  }) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/usuarios',
        data: {
          'etiqueta': etiqueta,
          'rol_ids': [rolId],
          'sufijo': ?sufijo,
          if (unidadSitioId != null && unidadNombre != null)
            'unidad': {'sitio_id': unidadSitioId, 'nombre': unidadNombre},
        },
      );
      return UsuarioCreadoDto.desde(r.data!);
    });
  }

  /// Solo el nombre se edita: el rol define el nivel y no cambia.
  Future<UsuarioAdminDto> editarUsuario(String id, {required String etiqueta}) {
    return _ejecutar(() async {
      final r = await _dio.patch<Map<String, dynamic>>(
        '/usuarios/$id',
        data: {'etiqueta': etiqueta},
      );
      return UsuarioAdminDto.desde(r.data!);
    });
  }

  /// Sin `confirmar`, un usuario con otros a su cargo responde 409
  /// `usuario.con_dependientes` con cuántos caerían; con él, la baja es en
  /// cascada (ADR 0028 §7).
  Future<void> eliminarUsuario(String id, {bool confirmar = false}) {
    return _ejecutar(() async {
      await _dio.delete<void>(
        '/usuarios/$id',
        queryParameters: confirmar ? {'confirmar': true} : null,
      );
    });
  }

  /// Anota que el PIN del usuario se compartió por un canal de terceros: queda
  /// en la bitácora con quién lo hizo y cuándo (ADR 0028 §7).
  Future<void> registrarPinCompartido(String usuarioId) {
    return _ejecutar(() async {
      await _dio.post<void>('/usuarios/$usuarioId/pin/compartido');
    });
  }

  /// El uso de los usuarios de la rama de quien pregunta (ADR 0028 §4).
  Future<EstadisticasDeUsuariosDto> estadisticasDeUsuarios() {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>('/usuarios/estadisticas');
      return EstadisticasDeUsuariosDto.desde(r.data!);
    });
  }

  Future<CupoDto> cupo() {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>('/cupo');
      return CupoDto.desde(r.data!);
    });
  }

  /// Sin `sufijo`, el servidor sortea los 4 caracteres; con él, usa esos.
  Future<PinGeneradoDto> generarPin(String usuarioId, {String? sufijo}) {
    return _ejecutar(() async {
      final r = await _dio.post<Map<String, dynamic>>(
        '/usuarios/$usuarioId/pin',
        data: sufijo == null ? null : {'sufijo': sufijo},
      );
      return PinGeneradoDto.desde(r.data!);
    });
  }

  Future<List<SitioDeEstructuraDto>> estructura() {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>('/sitios');
      return [
        for (final s in r.data!['datos'] as List<dynamic>)
          SitioDeEstructuraDto.desde(s as Map<String, dynamic>),
      ];
    });
  }

  Future<void> crearSitio({
    required String nombre,
    String? direccion,
    String? zonaHoraria,
  }) {
    return _ejecutar(() async {
      await _dio.post<void>(
        '/sitios',
        data: {
          'nombre': nombre,
          'direccion': ?direccion,
          'zona_horaria': ?zonaHoraria,
        },
      );
    });
  }

  Future<void> editarSitio(
    String id, {
    String? nombre,
    String? direccion,
    bool? activo,
  }) {
    return _ejecutar(() async {
      await _dio.patch<void>(
        '/sitios/$id',
        data: {'nombre': ?nombre, 'direccion': ?direccion, 'activo': ?activo},
      );
    });
  }

  Future<void> eliminarSitio(String id) {
    return _ejecutar(() async {
      await _dio.delete<void>('/sitios/$id');
    });
  }

  Future<void> crearPuerta(
    String sitioId, {
    required String nombre,
    int? segundosApertura,
  }) {
    return _ejecutar(() async {
      await _dio.post<void>(
        '/sitios/$sitioId/puertas',
        data: {'nombre': nombre, 'segundos_apertura': ?segundosApertura},
      );
    });
  }

  Future<void> editarPuerta(
    String id, {
    String? nombre,
    int? segundosApertura,
    bool? activa,
  }) {
    return _ejecutar(() async {
      await _dio.patch<void>(
        '/puertas/$id',
        data: {
          'nombre': ?nombre,
          'segundos_apertura': ?segundosApertura,
          'activa': ?activa,
        },
      );
    });
  }

  Future<void> eliminarPuerta(String id) {
    return _ejecutar(() async {
      await _dio.delete<void>('/puertas/$id');
    });
  }

  Future<PuertasAsignadasDto> puertasAsignadas(String usuarioId) {
    return _ejecutar(() async {
      final r = await _dio.get<Map<String, dynamic>>(
        '/usuarios/$usuarioId/puertas-asignadas',
      );
      return PuertasAsignadasDto.desde(r.data!);
    });
  }

  Future<void> asignarPuertas(
    String usuarioId, {
    required bool todas,
    required List<String> puertaIds,
  }) {
    return _ejecutar(() async {
      await _dio.put<void>(
        '/usuarios/$usuarioId/puertas-asignadas',
        data: {'todas': todas, 'puerta_ids': puertaIds},
      );
    });
  }

  /// Cambia el nombre del propio usuario (`PATCH /perfil`).
  Future<void> editarPerfil({required String etiqueta}) {
    return _ejecutar(() async {
      await _dio.patch<void>('/perfil', data: {'etiqueta': etiqueta});
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
