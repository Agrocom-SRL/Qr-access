import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/notificaciones_contratos.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mi bandeja de notificaciones de la cuenta (ADR 0030 §6). Los tests lo
/// sustituyen por un fake con el shape del contrato.
abstract interface class NotificacionesRepositorio {
  Future<Pagina<Notificacion>> listar({
    required int pagina,
    required int porPagina,
    required bool soloNoLeidas,
  });

  /// Cuántas siguen sin leer (el contador del ícono de la cabecera).
  Future<int> contarNoLeidas();

  Future<void> marcarLeida(String id);

  /// Devuelve cuántas marcó.
  Future<int> marcarTodasLeidas();
}

class NotificacionesRepositorioApi implements NotificacionesRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<Pagina<Notificacion>> listar({
    required int pagina,
    required int porPagina,
    required bool soloNoLeidas,
  }) async {
    final respuesta = await _api.notificaciones(
      pagina: pagina,
      porPagina: porPagina,
      soloNoLeidas: soloNoLeidas,
    );
    return respuesta.aPagina(_aNotificacion);
  }

  @override
  Future<int> contarNoLeidas() => _api.contadorNotificaciones();

  @override
  Future<void> marcarLeida(String id) => _api.marcarNotificacionLeida(id);

  @override
  Future<int> marcarTodasLeidas() => _api.marcarTodasNotificacionesLeidas();

  Notificacion _aNotificacion(NotificacionDto dto) => Notificacion(
    id: dto.id,
    tipo: TipoNotificacion.desdeApi(dto.tipo, subtipo: dto.senalTipo),
    severidad: Severidad.desdeApi(dto.severidad),
    cantidad: dto.cantidad,
    leida: dto.leida,
    puertas: dto.puertas,
    sitio: dto.sitio,
    usuario: dto.usuarioEtiqueta,
    novedadAt: dto.novedadAt,
  );
}

final notificacionesRepositorioProvider = Provider<NotificacionesRepositorio>(
  (ref) => NotificacionesRepositorioApi(ref.watch(clienteApiProvider)),
);
