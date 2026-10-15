import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Lo que cada persona edita de sí misma. Los tests lo sustituyen por un fake.
abstract interface class PerfilRepositorio {
  /// Cambia el nombre. El PIN y los roles no se tocan desde acá: los
  /// administra el administrador de la cuenta (ADR 0018).
  Future<void> cambiarNombre(String nombre);
}

class PerfilRepositorioApi implements PerfilRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<void> cambiarNombre(String nombre) =>
      _api.editarPerfil(etiqueta: nombre);
}

final perfilRepositorioProvider = Provider<PerfilRepositorio>(
  (ref) => PerfilRepositorioApi(ref.watch(clienteApiProvider)),
);
