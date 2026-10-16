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
    Usuario usuario, {
    String? sufijo,
  }) async {
    state = usuario.id;
    try {
      final pin = await ref
          .read(usuariosRepositorioProvider)
          .generarPin(usuario, sufijo: sufijo);
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
    this.elegirSufijo = false,
    this.sufijo = '',
    this.puertas = const PuertasAsignadas(),
    this.puertasCargadas = false,
  });

  final String etiqueta;
  final Set<String> rolIds;
  final bool enviando;
  final ErrorDatosUsuario? errorDatos;
  final ErrorApi? errorApi;

  /// En edición: se guardó y el formulario sigue abierto (guía §2.3).
  final bool guardado;

  /// El administrador escribe los 4 caracteres del PIN en vez de sortearlos.
  final bool elegirSufijo;
  final String sufijo;

  /// Puertas asignadas (guardias). `puertasCargadas` evita pisar la asignación
  /// real con una vacía si todavía no se leyó.
  final PuertasAsignadas puertas;
  final bool puertasCargadas;

  FormularioUsuarioEstado copiar({
    String? etiqueta,
    Set<String>? rolIds,
    bool enviando = false,
    ErrorDatosUsuario? errorDatos,
    ErrorApi? errorApi,
    bool guardado = false,
    bool? elegirSufijo,
    String? sufijo,
    PuertasAsignadas? puertas,
    bool? puertasCargadas,
  }) => FormularioUsuarioEstado(
    etiqueta: etiqueta ?? this.etiqueta,
    rolIds: rolIds ?? this.rolIds,
    enviando: enviando,
    errorDatos: errorDatos,
    errorApi: errorApi,
    guardado: guardado,
    elegirSufijo: elegirSufijo ?? this.elegirSufijo,
    sufijo: sufijo ?? this.sufijo,
    puertas: puertas ?? this.puertas,
    puertasCargadas: puertasCargadas ?? this.puertasCargadas,
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

  void alternarSufijoElegido({required bool elegir}) =>
      state = state.copiar(elegirSufijo: elegir, sufijo: '');

  void cambiarSufijo(String sufijo) => state = state.copiar(sufijo: sufijo);

  /// Las puertas que ya tiene asignadas el usuario que se edita.
  void cargarPuertas(PuertasAsignadas puertas) =>
      state = state.copiar(puertas: puertas, puertasCargadas: true);

  void alternarTodasLasPuertas({required bool todas}) => state = state.copiar(
    puertas: PuertasAsignadas(todas: todas, puertaIds: state.puertas.puertaIds),
    puertasCargadas: true,
  );

  void alternarPuerta(String puertaId) {
    final ids = {...state.puertas.puertaIds};
    if (!ids.remove(puertaId)) ids.add(puertaId);
    state = state.copiar(
      puertas: PuertasAsignadas(puertaIds: ids),
      puertasCargadas: true,
    );
  }

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
    if (state.elegirSufijo && !sufijoDePinValido(state.sufijo)) {
      state = state.copiar(errorDatos: ErrorDatosUsuario.sufijoInvalido);
      return null;
    }
    return DatosUsuario(
      etiqueta: state.etiqueta,
      rolIds: state.rolIds,
      sufijoDePin: state.elegirSufijo ? state.sufijo.toUpperCase() : null,
    );
  }

  /// Crea el usuario y devuelve su PIN. Con [asignarPuertas], le deja
  /// asignadas las puertas elegidas.
  Future<PinGenerado?> crear({bool asignarPuertas = false}) async {
    if (state.enviando) return null;
    final datos = _validar();
    if (datos == null) return null;
    state = state.copiar(enviando: true);
    try {
      final repositorio = ref.read(usuariosRepositorioProvider);
      final pin = await repositorio.crear(datos);
      final id = pin.usuarioId;
      final hayPuertas =
          state.puertas.todas || state.puertas.puertaIds.isNotEmpty;
      if (asignarPuertas && id != null && hayPuertas) {
        await repositorio.asignarPuertas(id, state.puertas);
      }
      ref.invalidate(usuariosProvider);
      state = state.copiar();
      return pin;
    } on ErrorApi catch (error) {
      state = state.copiar(errorApi: error);
      return null;
    }
  }

  Future<bool> editar(String id, {bool asignarPuertas = false}) async {
    if (state.enviando) return false;
    final datos = _validar();
    if (datos == null) return false;
    state = state.copiar(enviando: true);
    try {
      final repositorio = ref.read(usuariosRepositorioProvider);
      await repositorio.editar(id, datos);
      if (asignarPuertas && state.puertasCargadas) {
        await repositorio.asignarPuertas(id, state.puertas);
      }
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
