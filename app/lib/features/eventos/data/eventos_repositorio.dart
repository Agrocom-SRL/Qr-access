import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/eventos_contratos.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Bitácora de accesos de la cuenta (HU-15). Los tests lo sustituyen por un
/// fake con el shape del contrato.
abstract interface class EventosRepositorio {
  Future<Pagina<EventoAcceso>> listar({
    required FiltroEventos filtro,
    required int pagina,
    required int porPagina,
  });

  Future<ResumenEventos> resumir(FiltroEventos filtro);
}

class EventosRepositorioApi implements EventosRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<Pagina<EventoAcceso>> listar({
    required FiltroEventos filtro,
    required int pagina,
    required int porPagina,
  }) async {
    final respuesta = await _api.eventosAcceso(
      pagina: pagina,
      porPagina: porPagina,
      filtro: _aFiltroApi(filtro),
    );
    return respuesta.aPagina(_aEvento);
  }

  @override
  Future<ResumenEventos> resumir(FiltroEventos filtro) async {
    final dto = await _api.resumenEventos(_aFiltroApi(filtro));
    return ResumenEventos(
      permitidos: dto.permitidos,
      rechazados: dto.rechazados,
      rechazadosPorMotivo: dto.rechazadosPorMotivo,
    );
  }

  FiltroEventosApi _aFiltroApi(FiltroEventos filtro) => FiltroEventosApi(
    resultado: filtro.resultado?.valorApi,
    puertaId: filtro.puertaId,
    desde: filtro.desde,
    hasta: filtro.hasta,
  );

  EventoAcceso _aEvento(EventoAccesoDto dto) => EventoAcceso(
    id: dto.id,
    ocurridoAt: dto.ocurridoAt,
    resultado: ResultadoEvento.desdeApi(dto.resultado),
    motivoCode: dto.motivoCode,
    puertaNombre: dto.puerta.nombre,
    sitioNombre: dto.sitio.nombre,
    qrEtiqueta: dto.qr?.etiqueta,
    emisorEtiqueta: dto.qr?.emisorEtiqueta,
  );
}

final eventosRepositorioProvider = Provider<EventosRepositorio>(
  (ref) => EventosRepositorioApi(ref.watch(clienteApiProvider)),
);
