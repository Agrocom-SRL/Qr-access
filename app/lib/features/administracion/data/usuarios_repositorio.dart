import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/usuarios_contratos.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Usuarios y roles de la cuenta (HU-06). Los tests lo sustituyen por un
/// fake con el shape del contrato.
abstract interface class UsuariosRepositorio {
  Future<Pagina<Usuario>> listar({required int pagina, required int porPagina});
  Future<List<Rol>> roles();

  /// Crea el usuario; el PIN llega solo acá.
  Future<PinGenerado> crear(DatosUsuario datos);
  Future<Usuario> editar(String id, DatosUsuario datos);
  Future<void> eliminar(String id);

  /// Regenera el PIN: el anterior deja de servir.
  Future<PinGenerado> generarPin(Usuario usuario);
}

class UsuariosRepositorioApi implements UsuariosRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<Pagina<Usuario>> listar({
    required int pagina,
    required int porPagina,
  }) async {
    final respuesta = await _api.usuarios(pagina: pagina, porPagina: porPagina);
    return respuesta.aPagina(_aUsuario);
  }

  @override
  Future<List<Rol>> roles() async => (await _api.roles()).map(_aRol).toList();

  @override
  Future<PinGenerado> crear(DatosUsuario datos) async {
    final dto = await _api.crearUsuario(
      etiqueta: datos.etiqueta,
      rolIds: datos.rolIds,
    );
    return PinGenerado(
      pin: dto.pin,
      usuarioEtiqueta: dto.usuario.etiqueta,
      roles: dto.usuario.roles.map(_aRol).toList(),
      esNuevo: true,
    );
  }

  @override
  Future<Usuario> editar(String id, DatosUsuario datos) async => _aUsuario(
    await _api.editarUsuario(
      id,
      etiqueta: datos.etiqueta,
      rolIds: datos.rolIds,
    ),
  );

  @override
  Future<void> eliminar(String id) => _api.eliminarUsuario(id);

  @override
  Future<PinGenerado> generarPin(Usuario usuario) async {
    final dto = await _api.generarPin(usuario.id);
    return PinGenerado(
      pin: dto.pin,
      usuarioEtiqueta: usuario.etiqueta,
      roles: usuario.roles,
      esNuevo: false,
    );
  }
}

Rol _aRol(RolDto dto) => Rol(id: dto.id, nombre: dto.nombre);

Usuario _aUsuario(UsuarioAdminDto dto) => Usuario(
  id: dto.id,
  etiqueta: dto.etiqueta,
  activo: dto.activo,
  roles: dto.roles.map(_aRol).toList(),
  pinGeneradoAt: dto.pinGeneradoAt,
  ultimoIngresoAt: dto.ultimoIngresoAt,
  creadoAt: dto.creadoAt,
);

final usuariosRepositorioProvider = Provider<UsuariosRepositorio>(
  (ref) => UsuariosRepositorioApi(ref.watch(clienteApiProvider)),
);
