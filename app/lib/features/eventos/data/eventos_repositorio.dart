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
    required int pagina,
    required int porPagina,
  });
}

class EventosRepositorioApi implements EventosRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<Pagina<EventoAcceso>> listar({
    required int pagina,
    required int porPagina,
  }) async {
    final respuesta = await _api.eventosAcceso(
      pagina: pagina,
      porPagina: porPagina,
    );
    return respuesta.aPagina(_aEvento);
  }

  EventoAcceso _aEvento(EventoAccesoDto dto) => EventoAcceso(
    id: dto.id,
    ocurridoAt: dto.ocurridoAt,
    resultado: ResultadoEvento.desdeApi(dto.resultado),
    motivoCode: dto.motivoCode,
    puertaNombre: dto.puerta.nombre,
  );
}

final eventosRepositorioProvider = Provider<EventosRepositorio>(
  (ref) => EventosRepositorioApi(ref.watch(clienteApiProvider)),
);
