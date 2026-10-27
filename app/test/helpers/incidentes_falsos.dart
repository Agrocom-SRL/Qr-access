import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';

/// Un incidente de prueba con los valores habituales. Cada test cambia lo suyo.
Incidente incidenteDePrueba({
  String id = '7',
  String usuarioId = 'otro',
  String? usuarioEtiqueta = 'Jorge',
  TipoDeIncidente tipo = TipoDeIncidente.usoImposible,
  EstadoDeIncidente estado = EstadoDeIncidente.sinResolver,
  ResolucionDeIncidente? resolucion,
  List<ResolucionDeIncidente> historial = const [],
  String? descripcion,
}) => Incidente(
  id: id,
  usuarioId: usuarioId,
  usuarioEtiqueta: usuarioEtiqueta,
  tipo: tipo,
  gravedad: GravedadDeIncidente.media,
  origen: OrigenDeIncidente.sistema,
  registradoPor: null,
  descripcion: descripcion,
  evidencia: const EvidenciaDeIncidente(
    cuantosQr: 1,
    cuantosAccesos: 2,
    cuantosLimites: 0,
  ),
  estado: estado,
  resolucion: resolucion,
  ocurridoAt: DateTime.utc(2026, 10, 26, 12),
  historial: historial,
);

/// Los incidentes en memoria. Anota cada pedido para que el test compruebe qué
/// se mandó a la API y cuántas veces.
class IncidentesRepositorioFalso implements IncidentesRepositorio {
  new({
    this.incidentes = const [],
    this.detalle,
    this.politicaDeCuenta,
    this.errorListar,
    this.errorVer,
    this.errorResolver,
    this.respuestaResolver,
  });

  final List<Incidente> incidentes;

  /// Lo que devuelve `ver`; si es `null`, se busca en [incidentes].
  final Incidente? detalle;
  final PoliticaDeIncidentes? politicaDeCuenta;
  final Exception? errorListar;
  final Exception? errorVer;
  final Exception? errorResolver;

  /// Lo que devuelve `resolver`; si es `null`, la respuesta sale del incidente.
  final RespuestaDeResolucion? respuestaResolver;

  final List<TipoDeIncidente?> tiposPedidos = [];
  final List<EstadoDeIncidente?> estadosPedidos = [];
  final List<({String id, ResultadoDeResolucion resultado, String? motivo})>
  resoluciones = [];

  @override
  Future<Pagina<Incidente>> listar({
    required int pagina,
    required int porPagina,
    TipoDeIncidente? tipo,
    EstadoDeIncidente? estado,
  }) async {
    tiposPedidos.add(tipo);
    estadosPedidos.add(estado);
    if (errorListar != null) throw errorListar!;
    return Pagina(
      datos: incidentes,
      pagina: pagina,
      porPagina: porPagina,
      total: incidentes.length,
    );
  }

  @override
  Future<Incidente> ver(String id) async {
    if (errorVer != null) throw errorVer!;
    return detalle ?? incidentes.firstWhere((incidente) => incidente.id == id);
  }

  @override
  Future<PoliticaDeIncidentes> politica() async =>
      politicaDeCuenta ??
      const PoliticaDeIncidentes(
        minimo: 3,
        ventanaDias: 30,
        restriccionAutomatica: false,
      );

  @override
  Future<RespuestaDeResolucion> resolver(
    String id, {
    required ResultadoDeResolucion resultado,
    String? motivo,
  }) async {
    resoluciones.add((id: id, resultado: resultado, motivo: motivo));
    if (errorResolver != null) throw errorResolver!;
    final respuesta = respuestaResolver;
    if (respuesta != null) return respuesta;
    final incidente = incidentes.firstWhere((i) => i.id == id);
    return RespuestaDeResolucion(incidente: incidente, reincidencia: null);
  }
}
