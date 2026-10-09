import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Página que se está viendo del listado de usuarios.
class PaginaUsuariosControlador extends Notifier<int> {
  @override
  int build() => 1;

  int get pagina => state;

  set pagina(int pagina) => state = pagina;
}

final NotifierProvider<PaginaUsuariosControlador, int> paginaUsuariosProvider =
    NotifierProvider.autoDispose<PaginaUsuariosControlador, int>(
      PaginaUsuariosControlador.new,
    );

final FutureProvider<Pagina<Usuario>> usuariosProvider =
    FutureProvider.autoDispose<Pagina<Usuario>>(
      (ref) => ref
          .watch(usuariosRepositorioProvider)
          .listar(
            pagina: ref.watch(paginaUsuariosProvider),
            porPagina: porPaginaPorDefecto,
          ),
    );

final FutureProvider<List<Rol>> rolesProvider =
    FutureProvider.autoDispose<List<Rol>>(
      (ref) => ref.watch(usuariosRepositorioProvider).roles(),
    );

/// Acciones sobre un usuario del listado: generar PIN y eliminar. El estado
/// es el id del usuario con una acción en curso.
class AccionesUsuarioControlador extends Notifier<String?> {
  @override
  String? build() => null;

  /// Devuelve el PIN nuevo, o el error de la API.
  Future<({PinGenerado? pin, ErrorApi? error})> generarPin(
    Usuario usuario,
  ) async {
    state = usuario.id;
    try {
      final pin = await ref
          .read(usuariosRepositorioProvider)
          .generarPin(usuario);
      ref.invalidate(usuariosProvider);
      return (pin: pin, error: null);
    } on ErrorApi catch (error) {
      return (pin: null, error: error);
    } finally {
      state = null;
    }
  }

  Future<ErrorApi?> eliminar(Usuario usuario) async {
    state = usuario.id;
    try {
      await ref.read(usuariosRepositorioProvider).eliminar(usuario.id);
      ref.invalidate(usuariosProvider);
      return null;
    } on ErrorApi catch (error) {
      return error;
    } finally {
      state = null;
    }
  }
}

final NotifierProvider<AccionesUsuarioControlador, String?>
accionesUsuarioProvider =
    NotifierProvider.autoDispose<AccionesUsuarioControlador, String?>(
      AccionesUsuarioControlador.new,
    );

/// Estado del formulario de usuario (nuevo o edición).
@immutable
class FormularioUsuarioEstado {
  const new({
    this.etiqueta = '',
    this.rolIds = const {},
    this.enviando = false,
    this.errorDatos,
    this.errorApi,
    this.guardado = false,
  });

  final String etiqueta;
  final Set<String> rolIds;
  final bool enviando;
  final ErrorDatosUsuario? errorDatos;
  final ErrorApi? errorApi;

  /// En edición: se guardó y el formulario sigue abierto (guía §2.3).
  final bool guardado;

  FormularioUsuarioEstado copiar({
    String? etiqueta,
    Set<String>? rolIds,
    bool enviando = false,
    ErrorDatosUsuario? errorDatos,
    ErrorApi? errorApi,
    bool guardado = false,
  }) => FormularioUsuarioEstado(
    etiqueta: etiqueta ?? this.etiqueta,
    rolIds: rolIds ?? this.rolIds,
    enviando: enviando,
    errorDatos: errorDatos,
    errorApi: errorApi,
    guardado: guardado,
  );
}

/// Crear o editar un usuario (HU-06). Crear devuelve el PIN para mostrarlo
/// una sola vez.
class FormularioUsuarioControlador extends Notifier<FormularioUsuarioEstado> {
  @override
  FormularioUsuarioEstado build() => const FormularioUsuarioEstado();

  void cargar(Usuario usuario) => state = FormularioUsuarioEstado(
    etiqueta: usuario.etiqueta ?? '',
    rolIds: usuario.roles.map((r) => r.id).toSet(),
  );

  void cambiarEtiqueta(String etiqueta) =>
      state = state.copiar(etiqueta: etiqueta);

  void alternarRol(String rolId) {
    final ids = {...state.rolIds};
    if (!ids.remove(rolId)) ids.add(rolId);
    state = state.copiar(rolIds: ids);
  }

  DatosUsuario? _validar() {
    final error = DatosUsuario.errorDe(
      etiqueta: state.etiqueta,
      rolIds: state.rolIds,
    );
    if (error != null) {
      state = state.copiar(errorDatos: error);
      return null;
    }
    return DatosUsuario(etiqueta: state.etiqueta, rolIds: state.rolIds);
  }

  Future<PinGenerado?> crear() async {
    if (state.enviando) return null;
    final datos = _validar();
    if (datos == null) return null;
    state = state.copiar(enviando: true);
    try {
      final pin = await ref.read(usuariosRepositorioProvider).crear(datos);
      ref.invalidate(usuariosProvider);
      state = state.copiar();
      return pin;
    } on ErrorApi catch (error) {
      state = state.copiar(errorApi: error);
      return null;
    }
  }

  Future<bool> editar(String id) async {
    if (state.enviando) return false;
    final datos = _validar();
    if (datos == null) return false;
    state = state.copiar(enviando: true);
    try {
      await ref.read(usuariosRepositorioProvider).editar(id, datos);
      ref.invalidate(usuariosProvider);
      state = state.copiar(guardado: true);
      return true;
    } on ErrorApi catch (error) {
      state = state.copiar(errorApi: error);
      return false;
    }
  }
}

final NotifierProvider<FormularioUsuarioControlador, FormularioUsuarioEstado>
formularioUsuarioProvider =
    NotifierProvider.autoDispose<
      FormularioUsuarioControlador,
      FormularioUsuarioEstado
    >(FormularioUsuarioControlador.new);
