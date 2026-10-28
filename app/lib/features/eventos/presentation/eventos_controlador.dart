import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sincronizacion/controlador_sincronizacion.dart';
import 'package:agrocom_acceso/core/sincronizacion/estado_sincronizacion.dart';
import 'package:agrocom_acceso/features/eventos/data/eventos_repositorio.dart';
import 'package:agrocom_acceso/features/eventos/domain/lectura.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;

/// Filtro y página de la bitácora. Cambiar un filtro vuelve a la página 1.
@immutable
class ConsultaEventos {
  const new({this.filtro = const FiltroEventos(), this.pagina = 1});

  final FiltroEventos filtro;
  final int pagina;

  @override
  bool operator ==(Object other) =>
      other is ConsultaEventos &&
      other.filtro == filtro &&
      other.pagina == pagina;

  @override
  int get hashCode => Object.hash(filtro, pagina);
}

class ConsultaEventosControlador extends Notifier<ConsultaEventos> {
  @override
  ConsultaEventos build() => const ConsultaEventos();

  void elegirResultado(ResultadoEvento? resultado) => state = ConsultaEventos(
    filtro: state.filtro.copiar(
      resultado: resultado,
      quitarResultado: resultado == null,
    ),
  );

  void elegirPuerta(String? puertaId) => state = ConsultaEventos(
    filtro: state.filtro.copiar(
      puertaId: puertaId,
      quitarPuerta: puertaId == null,
    ),
  );

  void irAPagina(int pagina) =>
      state = ConsultaEventos(filtro: state.filtro, pagina: pagina);
}

final NotifierProvider<ConsultaEventosControlador, ConsultaEventos>
consultaEventosProvider =
    NotifierProvider.autoDispose<ConsultaEventosControlador, ConsultaEventos>(
      ConsultaEventosControlador.new,
    );

/// Eventos de una consulta. Es una familia para que cada pestaña de resultado
/// tenga su lista mientras se desliza entre ellas. Se recarga al cambiar
/// filtro o página.
final FutureProviderFamily<Pagina<Lectura>, ConsultaEventos> eventosProvider =
    FutureProvider.autoDispose.family<Pagina<Lectura>, ConsultaEventos>(
      (ref, consulta) => ref
          .watch(eventosRepositorioProvider)
          .listar(
            filtro: consulta.filtro,
            pagina: consulta.pagina,
            porPagina: porPaginaPorDefecto,
          ),
    );

/// Sincronización de Lecturas (ver `ControladorSincronizacion`): vuelve a pedir
/// la consulta elegida (filtro y página), no las pestañas que no se ven.
class SincronizacionEventosControlador extends ControladorSincronizacion {
  @override
  Future<void> recargarListado() async {
    final consulta = ref.read(consultaEventosProvider);
    ref.invalidate(eventosProvider(consulta));
    await ref.read(eventosProvider(consulta).future);
  }
}

/// Estado de sincronización de Lecturas; se descarta al salir de la pantalla.
final NotifierProvider<SincronizacionEventosControlador, EstadoSincronizacion>
sincronizacionEventosProvider =
    NotifierProvider.autoDispose<
      SincronizacionEventosControlador,
      EstadoSincronizacion
    >(SincronizacionEventosControlador.new);
