import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/sesiones_contratos.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mis sesiones abiertas (ADR 0030 §4.1). Los tests lo sustituyen por un fake
/// con el shape del contrato.
abstract interface class SesionesRepositorio {
  Future<Pagina<SesionConectada>> listar();

  /// Cierra una de mis sesiones (no la actual; esa se cierra saliendo).
  Future<void> cerrar(String id);

  /// Cierra todas mis sesiones menos la actual. Devuelve cuántas cerró.
  Future<int> cerrarOtras();

  /// Pone el nombre de este aparato (la sesión actual). Pendiente de backend:
  /// ver `ClienteApi.renombrarMiSesionActual`.
  Future<void> renombrarActual(String dispositivo);
}

class SesionesRepositorioApi implements SesionesRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<Pagina<SesionConectada>> listar() async {
    final respuesta = await _api.misSesiones();
    return respuesta.aPagina(_aSesion);
  }

  @override
  Future<void> cerrar(String id) => _api.cerrarMiSesion(id);

  @override
  Future<int> cerrarOtras() => _api.cerrarMisOtrasSesiones();

  @override
  Future<void> renombrarActual(String dispositivo) =>
      _api.renombrarMiSesionActual(dispositivo);

  SesionConectada _aSesion(SesionAbiertaDto dto) => SesionConectada(
    id: dto.id,
    plataforma: dto.plataforma,
    dispositivo: dto.dispositivo,
    ultimaActividadAt: dto.ultimaActividadAt,
    actual: dto.actual,
  );
}

final sesionesRepositorioProvider = Provider<SesionesRepositorio>(
  (ref) => SesionesRepositorioApi(ref.watch(clienteApiProvider)),
);
