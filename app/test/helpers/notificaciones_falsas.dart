import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';

/// La bandeja en memoria. [noLeidas] es lo que responde el contador; el listado
/// sale de [notificaciones], filtrado como lo haría la API.
class NotificacionesRepositorioFalso implements NotificacionesRepositorio {
  new({
    this.notificaciones = const [],
    this.noLeidas = 0,
    this.errorListar,
    this.errorMarcar,
  });

  final List<Notificacion> notificaciones;
  int noLeidas;
  final Exception? errorListar;
  final Exception? errorMarcar;
  final List<bool> filtrosPedidos = [];
  final List<String> marcadas = [];
  int pedidosDeMarcarTodas = 0;

  @override
  Future<Pagina<Notificacion>> listar({
    required int pagina,
    required int porPagina,
    required bool soloNoLeidas,
  }) async {
    filtrosPedidos.add(soloNoLeidas);
    if (errorListar != null) throw errorListar!;
    final datos = soloNoLeidas
        ? notificaciones.where((aviso) => !aviso.leida).toList()
        : notificaciones;
    return Pagina(
      datos: datos,
      pagina: pagina,
      porPagina: porPagina,
      total: datos.length,
    );
  }

  @override
  Future<int> contarNoLeidas() async => noLeidas;

  @override
  Future<void> marcarLeida(String id) async {
    if (errorMarcar != null) throw errorMarcar!;
    marcadas.add(id);
  }

  @override
  Future<int> marcarTodasLeidas() async {
    pedidosDeMarcarTodas++;
    if (errorMarcar != null) throw errorMarcar!;
    return notificaciones.where((aviso) => !aviso.leida).length;
  }
}
