import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/incidentes_contratos.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Los incidentes de uso de mi rama (ADR 0033 §4). Los tests lo sustituyen por
/// un fake con el shape del contrato.
abstract interface class IncidentesRepositorio {
  /// De la más reciente a la más antigua; la API ya filtra por mi rama.
  Future<Pagina<Incidente>> listar({
    required int pagina,
    required int porPagina,
    TipoDeIncidente? tipo,
    EstadoDeIncidente? estado,
  });

  Future<Incidente> ver(String id);

  Future<PoliticaDeIncidentes> politica();

  /// Descarta, confirma o deja pendiente. Confirmar exige [motivo].
  Future<RespuestaDeResolucion> resolver(
    String id, {
    required ResultadoDeResolucion resultado,
    String? motivo,
  });
}

class IncidentesRepositorioApi implements IncidentesRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<Pagina<Incidente>> listar({
    required int pagina,
    required int porPagina,
    TipoDeIncidente? tipo,
    EstadoDeIncidente? estado,
  }) async {
    final respuesta = await _api.incidentes(
      pagina: pagina,
      porPagina: porPagina,
      tipo: tipo?.api,
      estado: estado?.api,
    );
    return respuesta.aPagina(_aIncidente);
  }

  @override
  Future<Incidente> ver(String id) async =>
      _aIncidente(await _api.incidente(id));

  @override
  Future<PoliticaDeIncidentes> politica() async {
    final dto = await _api.politicaDeIncidentes();
    return PoliticaDeIncidentes(
      minimo: dto.reincidenciaMinimo,
      ventanaDias: dto.reincidenciaVentanaDias,
      restriccionAutomatica: dto.restriccionAutomatica,
    );
  }

  @override
  Future<RespuestaDeResolucion> resolver(
    String id, {
    required ResultadoDeResolucion resultado,
    String? motivo,
  }) async {
    final dto = await _api.resolverIncidente(
      id,
      resultado: resultado.api,
      motivo: motivo,
    );
    return _aRespuesta(dto);
  }

  RespuestaDeResolucion _aRespuesta(RespuestaResolucionDto dto) {
    final reincidencia = dto.reincidencia;
    return RespuestaDeResolucion(
      incidente: _aIncidente(dto.incidente),
      reincidencia: reincidencia == null
          ? null
          : ReincidenciaDeIncidente(
              confirmados: reincidencia.confirmados,
              minimo: reincidencia.minimo,
              ventanaDias: reincidencia.ventanaDias,
              propuesta: AccionPropuesta.desdeApi(reincidencia.propuesta),
              aplicadaAutomaticamente: reincidencia.aplicadaAutomaticamente,
            ),
    );
  }

  Incidente _aIncidente(IncidenteDto dto) => Incidente(
    id: dto.id,
    usuarioId: dto.usuario.id,
    usuarioEtiqueta: dto.usuario.etiqueta,
    tipo: TipoDeIncidente.desdeApi(dto.tipo),
    gravedad: GravedadDeIncidente.desdeApi(dto.gravedad),
    origen: OrigenDeIncidente.desdeApi(dto.origen),
    registradoPor: dto.registradoPor?.etiqueta,
    descripcion: dto.descripcion,
    evidencia: EvidenciaDeIncidente(
      cuantosQr: dto.evidencia.cuantosQr,
      cuantosAccesos: dto.evidencia.cuantosAccesos,
      cuantosLimites: dto.evidencia.cuantosLimites,
    ),
    estado: EstadoDeIncidente.desdeApi(dto.estado),
    resolucion: _aResolucion(dto.resolucion),
    ocurridoAt: dto.ocurridoAt,
    historial: [for (final r in dto.historial) _aDeResolucion(r)],
  );

  ResolucionDeIncidente? _aResolucion(ResolucionDto? dto) =>
      dto == null ? null : _aDeResolucion(dto);

  ResolucionDeIncidente _aDeResolucion(ResolucionDto dto) =>
      ResolucionDeIncidente(
        resultado: ResultadoDeResolucion.desdeApi(dto.resultado),
        motivo: dto.motivo,
        resueltoPor: dto.resueltoPor.etiqueta,
        resueltaAt: dto.resueltaAt,
      );
}

final incidentesRepositorioProvider = Provider<IncidentesRepositorio>(
  (ref) => IncidentesRepositorioApi(ref.watch(clienteApiProvider)),
);
