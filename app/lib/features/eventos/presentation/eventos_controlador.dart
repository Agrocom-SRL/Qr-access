import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/eventos/data/eventos_repositorio.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Página que se está viendo en la bitácora. Vuelve a 1 al reingresar.
class PaginaEventosControlador extends Notifier<int> {
  @override
  int build() => 1;

  int get pagina => state;

  set pagina(int pagina) => state = pagina;
}

final NotifierProvider<PaginaEventosControlador, int> paginaEventosProvider =
    NotifierProvider.autoDispose<PaginaEventosControlador, int>(
      PaginaEventosControlador.new,
    );

/// Eventos de la página actual. Se recarga al cambiar de página.
final FutureProvider<Pagina<EventoAcceso>> eventosProvider =
    FutureProvider.autoDispose<Pagina<EventoAcceso>>((ref) {
      return ref
          .watch(eventosRepositorioProvider)
          .listar(
            pagina: ref.watch(paginaEventosProvider),
            porPagina: porPaginaPorDefecto,
          );
    });
