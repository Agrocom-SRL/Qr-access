import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/dispositivos/data/sesiones_repositorio.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';

/// Mis sesiones abiertas en memoria. Anota qué se cerró y cuántas veces se
/// pidió cerrar las demás.
class SesionesRepositorioFalso implements SesionesRepositorio {
  new({
    this.sesiones = const [],
    this.errorListar,
    this.errorCerrar,
    this.cerradasDeOtras = 0,
    this.errorCerrarOtras,
    this.errorRenombrar,
  });

  final List<SesionConectada> sesiones;
  final Exception? errorListar;
  final Exception? errorCerrar;
  final int cerradasDeOtras;
  final Exception? errorCerrarOtras;
  final Exception? errorRenombrar;
  final List<String> cerradas = [];

  /// Los nombres que la pantalla pidió poner, en orden.
  final List<String> nombresPedidos = [];
  int pedidosDeCerrarOtras = 0;

  @override
  Future<Pagina<SesionConectada>> listar() async {
    if (errorListar != null) throw errorListar!;
    return Pagina(
      datos: sesiones,
      pagina: 1,
      porPagina: porPaginaPorDefecto,
      total: sesiones.length,
    );
  }

  @override
  Future<void> cerrar(String id) async {
    if (errorCerrar != null) throw errorCerrar!;
    cerradas.add(id);
  }

  @override
  Future<int> cerrarOtras() async {
    pedidosDeCerrarOtras++;
    if (errorCerrarOtras != null) throw errorCerrarOtras!;
    return cerradasDeOtras;
  }

  @override
  Future<void> renombrarActual(String dispositivo) async {
    if (errorRenombrar != null) throw errorRenombrar!;
    nombresPedidos.add(dispositivo);
  }
}
