import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/features/administracion/data/estructura_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Los sitios con todas sus puertas, para gestionarlos.
final FutureProvider<List<SitioGestionado>> estructuraProvider =
    FutureProvider.autoDispose<List<SitioGestionado>>(
      (ref) => ref.watch(estructuraRepositorioProvider).listar(),
    );

/// Las acciones de la gestión. El estado es `true` mientras una está en curso;
/// cada una devuelve el error de la API o `null` si salió bien.
class AccionesEstructuraControlador extends Notifier<bool> {
  @override
  bool build() => false;

  EstructuraRepositorio get _repositorio =>
      ref.read(estructuraRepositorioProvider);

  Future<ErrorApi?> crearSitio(DatosSitio datos) =>
      _ejecutar(() => _repositorio.crearSitio(datos));

  Future<ErrorApi?> editarSitio(String id, DatosSitio datos) =>
      _ejecutar(() => _repositorio.editarSitio(id, datos));

  Future<ErrorApi?> eliminarSitio(String id) =>
      _ejecutar(() => _repositorio.eliminarSitio(id));

  Future<ErrorApi?> crearPuerta(String sitioId, DatosPuerta datos) =>
      _ejecutar(() => _repositorio.crearPuerta(sitioId, datos));

  Future<ErrorApi?> editarPuerta(String id, DatosPuerta datos) =>
      _ejecutar(() => _repositorio.editarPuerta(id, datos));

  Future<ErrorApi?> eliminarPuerta(String id) =>
      _ejecutar(() => _repositorio.eliminarPuerta(id));

  Future<ErrorApi?> _ejecutar(Future<void> Function() accion) async {
    if (state) return null;
    state = true;
    try {
      await accion();
      // Lo que cambió se ve en esta gestión y en el listado de puertas.
      ref
        ..invalidate(estructuraProvider)
        ..invalidate(puertasDisponiblesProvider);
      return null;
    } on ErrorApi catch (error) {
      return error;
    } finally {
      state = false;
    }
  }
}

final NotifierProvider<AccionesEstructuraControlador, bool>
accionesEstructuraProvider =
    NotifierProvider.autoDispose<AccionesEstructuraControlador, bool>(
      AccionesEstructuraControlador.new,
    );
