import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/estructura_contratos.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Sitios y puertas de la cuenta, gestionados por su administrador (HU-07).
/// Los tests lo sustituyen por un fake con el shape del contrato.
abstract interface class EstructuraRepositorio {
  Future<List<SitioGestionado>> listar();
  Future<void> crearSitio(DatosSitio datos);
  Future<void> editarSitio(String id, DatosSitio datos);
  Future<void> eliminarSitio(String id);
  Future<void> crearPuerta(String sitioId, DatosPuerta datos);
  Future<void> editarPuerta(String id, DatosPuerta datos);
  Future<void> eliminarPuerta(String id);
}

class EstructuraRepositorioApi implements EstructuraRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<List<SitioGestionado>> listar() async =>
      (await _api.estructura()).map(_aSitio).toList();

  @override
  Future<void> crearSitio(DatosSitio datos) =>
      _api.crearSitio(nombre: datos.nombre, direccion: datos.direccion);

  @override
  Future<void> editarSitio(String id, DatosSitio datos) => _api.editarSitio(
    id,
    nombre: datos.nombre,
    // Vacía la dirección cuando se borró el texto.
    direccion: datos.direccion ?? '',
  );

  @override
  Future<void> eliminarSitio(String id) => _api.eliminarSitio(id);

  @override
  Future<void> crearPuerta(String sitioId, DatosPuerta datos) =>
      _api.crearPuerta(
        sitioId,
        nombre: datos.nombre,
        segundosApertura: datos.segundosApertura,
      );

  @override
  Future<void> editarPuerta(String id, DatosPuerta datos) => _api.editarPuerta(
    id,
    nombre: datos.nombre,
    segundosApertura: datos.segundosApertura,
  );

  @override
  Future<void> eliminarPuerta(String id) => _api.eliminarPuerta(id);
}

SitioGestionado _aSitio(SitioDeEstructuraDto dto) => SitioGestionado(
  id: dto.id,
  nombre: dto.nombre,
  direccion: dto.direccion,
  puertas: [
    for (final p in dto.puertas)
      PuertaGestionada(
        id: p.id,
        nombre: p.nombre,
        segundosApertura: p.segundosApertura,
        activa: p.activa,
        tieneLector: p.dispositivo != null,
      ),
  ],
);

final estructuraRepositorioProvider = Provider<EstructuraRepositorio>(
  (ref) => EstructuraRepositorioApi(ref.watch(clienteApiProvider)),
);
