import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;

/// Qué se ve de la bandeja: solo las no leídas o todas, y la página. Inmutable.
@immutable
class FiltroNotificaciones {
  const new({this.soloNoLeidas = false, this.pagina = 1});

  final bool soloNoLeidas;
  final int pagina;

  @override
  bool operator ==(Object other) =>
      other is FiltroNotificaciones &&
      other.soloNoLeidas == soloNoLeidas &&
      other.pagina == pagina;

  @override
  int get hashCode => Object.hash(soloNoLeidas, pagina);
}

/// Cambiar el filtro vuelve a la página 1.
class FiltroNotificacionesControlador extends Notifier<FiltroNotificaciones> {
  @override
  FiltroNotificaciones build() => const FiltroNotificaciones();

  void elegirSoloNoLeidas({required bool soloNoLeidas}) =>
      state = FiltroNotificaciones(soloNoLeidas: soloNoLeidas);

  void irAPagina(int pagina) => state = FiltroNotificaciones(
    soloNoLeidas: state.soloNoLeidas,
    pagina: pagina,
  );
}

final NotifierProvider<FiltroNotificacionesControlador, FiltroNotificaciones>
filtroNotificacionesProvider =
    NotifierProvider.autoDispose<
      FiltroNotificacionesControlador,
      FiltroNotificaciones
    >(FiltroNotificacionesControlador.new);

/// La bandeja de un filtro. Se invalida al marcar algo como leído.
final FutureProviderFamily<Pagina<Notificacion>, FiltroNotificaciones>
listadoNotificacionesProvider = FutureProvider.autoDispose
    .family<Pagina<Notificacion>, FiltroNotificaciones>(
      (ref, filtro) => ref
          .watch(notificacionesRepositorioProvider)
          .listar(
            pagina: filtro.pagina,
            porPagina: porPaginaPorDefecto,
            soloNoLeidas: filtro.soloNoLeidas,
          ),
    );

/// Cuántas siguen sin leer: el contador del ícono de la cabecera.
final FutureProvider<int> contadorNotificacionesProvider =
    FutureProvider.autoDispose<int>(
      (ref) => ref.watch(notificacionesRepositorioProvider).contarNoLeidas(),
    );

/// Marca notificaciones como leídas. El estado es si hay una marca en curso.
/// Los errores se devuelven, no se lanzan: la pantalla decide cómo mostrarlos.
class MarcarNotificacionesControlador extends Notifier<bool> {
  @override
  bool build() => false;

  Future<ErrorApi?> marcarLeida(String id) async {
    state = true;
    try {
      await ref.read(notificacionesRepositorioProvider).marcarLeida(id);
      return null;
    } on ErrorApi catch (error) {
      return error;
    } finally {
      _refrescar();
    }
  }

  Future<({int marcadas, ErrorApi? error})> marcarTodas() async {
    state = true;
    try {
      final marcadas = await ref
          .read(notificacionesRepositorioProvider)
          .marcarTodasLeidas();
      return (marcadas: marcadas, error: null);
    } on ErrorApi catch (error) {
      return (marcadas: 0, error: error);
    } finally {
      _refrescar();
    }
  }

  void _refrescar() {
    ref
      ..invalidate(listadoNotificacionesProvider)
      ..invalidate(contadorNotificacionesProvider);
    state = false;
  }
}

final NotifierProvider<MarcarNotificacionesControlador, bool>
marcarNotificacionesProvider =
    NotifierProvider.autoDispose<MarcarNotificacionesControlador, bool>(
      MarcarNotificacionesControlador.new,
    );
