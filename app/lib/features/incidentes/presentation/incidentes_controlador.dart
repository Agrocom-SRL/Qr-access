import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;

/// Qué se ve del listado: el tipo, el estado y la página. `null` = todos.
/// Inmutable.
@immutable
class FiltroIncidentes {
  const new({this.tipo, this.estado, this.pagina = 1});

  final TipoDeIncidente? tipo;
  final EstadoDeIncidente? estado;
  final int pagina;

  @override
  bool operator ==(Object other) =>
      other is FiltroIncidentes &&
      other.tipo == tipo &&
      other.estado == estado &&
      other.pagina == pagina;

  @override
  int get hashCode => Object.hash(tipo, estado, pagina);
}

/// Cambiar un filtro vuelve a la página 1.
class FiltroIncidentesControlador extends Notifier<FiltroIncidentes> {
  @override
  FiltroIncidentes build() => const FiltroIncidentes();

  void elegirTipo(TipoDeIncidente? tipo) =>
      state = FiltroIncidentes(tipo: tipo, estado: state.estado);

  void elegirEstado(EstadoDeIncidente? estado) =>
      state = FiltroIncidentes(tipo: state.tipo, estado: estado);

  void irAPagina(int pagina) => state = FiltroIncidentes(
    tipo: state.tipo,
    estado: state.estado,
    pagina: pagina,
  );
}

final NotifierProvider<FiltroIncidentesControlador, FiltroIncidentes>
filtroIncidentesProvider =
    NotifierProvider.autoDispose<FiltroIncidentesControlador, FiltroIncidentes>(
      FiltroIncidentesControlador.new,
    );

/// Una página de incidentes con sus filtros. Se invalida al resolver alguno.
final FutureProviderFamily<Pagina<Incidente>, FiltroIncidentes>
listadoIncidentesProvider = FutureProvider.autoDispose
    .family<Pagina<Incidente>, FiltroIncidentes>(
      (ref, filtro) => ref
          .watch(incidentesRepositorioProvider)
          .listar(
            pagina: filtro.pagina,
            porPagina: porPaginaPorDefecto,
            tipo: filtro.tipo,
            estado: filtro.estado,
          ),
    );

/// La política de reincidencia de la cuenta, para explicar el umbral.
final FutureProvider<PoliticaDeIncidentes> politicaIncidentesProvider =
    FutureProvider.autoDispose<PoliticaDeIncidentes>(
      (ref) => ref.watch(incidentesRepositorioProvider).politica(),
    );

/// Un incidente con su historial. Se invalida al resolverlo.
final FutureProviderFamily<Incidente, String> incidenteProvider = FutureProvider
    .autoDispose
    .family<Incidente, String>(
      (ref, id) => ref.watch(incidentesRepositorioProvider).ver(id),
    );

/// Lo que devuelve resolver: la respuesta (si salió bien) o el error de la API
/// para que la pantalla lo traduzca. No se lanza.
@immutable
class EnvioDeResolucion {
  const new({this.respuesta, this.error});

  final RespuestaDeResolucion? respuesta;
  final ErrorApi? error;
}

/// Descarta, confirma o deja pendiente un incidente. El estado es si hay una
/// resolución en curso, para que el botón no se pulse dos veces.
class ResolucionIncidenteControlador extends Notifier<bool> {
  @override
  bool build() => false;

  Future<EnvioDeResolucion> resolver(
    String id, {
    required ResultadoDeResolucion resultado,
    String? motivo,
  }) async {
    state = true;
    try {
      final respuesta = await ref
          .read(incidentesRepositorioProvider)
          .resolver(id, resultado: resultado, motivo: motivo);
      return EnvioDeResolucion(respuesta: respuesta);
    } on ErrorApi catch (error) {
      return EnvioDeResolucion(error: error);
    } finally {
      // Con éxito cambia el estado del incidente y el listado; con error, la
      // pantalla vuelve a leer lo que hay en la API.
      ref
        ..invalidate(incidenteProvider(id))
        ..invalidate(listadoIncidentesProvider);
      state = false;
    }
  }
}

final NotifierProvider<ResolucionIncidenteControlador, bool>
resolucionIncidenteProvider =
    NotifierProvider.autoDispose<ResolucionIncidenteControlador, bool>(
      ResolucionIncidenteControlador.new,
    );
