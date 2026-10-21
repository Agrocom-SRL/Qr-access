import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/cupo.dart';
import 'package:agrocom_acceso/features/administracion/domain/nivel_usuario.dart';
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

/// El uso del cupo de usuarios del plan: solo se pide con `seguridad.cupo.ver`.
final FutureProvider<Cupo> cupoProvider = FutureProvider.autoDispose<Cupo>(
  (ref) => ref.watch(usuariosRepositorioProvider).cupo(),
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

  /// Sin [confirmar], quien tiene a otros a su cargo responde
  /// `usuario.con_dependientes` con cuántos caerían; con él, la baja es en
  /// cascada y libera todos esos lugares del cupo (ADR 0028 §7).
  Future<ErrorApi?> eliminar(Usuario usuario, {bool confirmar = false}) async {
    state = usuario.id;
    try {
      await ref
          .read(usuariosRepositorioProvider)
          .eliminar(usuario.id, confirmar: confirmar);
      ref
        ..invalidate(usuariosProvider)
        ..invalidate(cupoProvider);
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
    this.rol,
    this.sitioId,
    this.unidad = '',
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

  /// El único rol del usuario nuevo (ADR 0028).
  final Rol? rol;

  /// Propiedad y nombre de la unidad: solo para un Titular.
  final String? sitioId;
  final String unidad;
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

  /// El nivel del rol elegido; `null` si aún no eligió.
  NivelUsuario? get nivel => rol == null ? null : nivelDeRol(rol!.nombre);

  FormularioUsuarioEstado copiar({
    String? etiqueta,
    Rol? rol,
    bool sinRol = false,
    String? sitioId,
    bool sinSitio = false,
    String? unidad,
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
    rol: sinRol ? null : rol ?? this.rol,
    sitioId: sinSitio ? null : sitioId ?? this.sitioId,
    unidad: unidad ?? this.unidad,
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

  /// Al editar solo cuenta el nombre: el rol y la unidad no se tocan.
  void cargar(Usuario usuario) =>
      state = FormularioUsuarioEstado(etiqueta: usuario.etiqueta ?? '');

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

  /// Elige el rol del usuario nuevo. Al cambiar a un nivel que no es Titular,
  /// la unidad ya no corresponde y se descarta.
  void elegirRol(Rol rol) {
    final esTitular = nivelDeRol(rol.nombre) == NivelUsuario.titular;
    state = state.copiar(
      rol: rol,
      sinSitio: !esTitular,
      unidad: esTitular ? state.unidad : '',
    );
  }

  void elegirPropiedad(String? sitioId) => state = sitioId == null
      ? state.copiar(sinSitio: true)
      : state.copiar(sitioId: sitioId);

  void cambiarUnidad(String unidad) => state = state.copiar(unidad: unidad);

  DatosUsuario? _validarAlta() {
    final error = DatosUsuario.errorDe(
      etiqueta: state.etiqueta,
      rolId: state.rol?.id,
      nivel: state.nivel,
      sitioId: state.sitioId,
      unidad: state.unidad,
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
      rolId: state.rol!.id,
      unidad: state.nivel == NivelUsuario.titular
          ? DatosUnidad(sitioId: state.sitioId!, nombre: state.unidad.trim())
          : null,
      sufijoDePin: state.elegirSufijo ? state.sufijo.toUpperCase() : null,
    );
  }

  /// Crea el usuario y devuelve su PIN. Con [asignarPuertas], le deja
  /// asignadas las puertas elegidas.
  Future<PinGenerado?> crear({bool asignarPuertas = false}) async {
    if (state.enviando) return null;
    final datos = _validarAlta();
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
      ref
        ..invalidate(usuariosProvider)
        ..invalidate(cupoProvider);
      state = state.copiar();
      return pin;
    } on ErrorApi catch (error) {
      state = state.copiar(errorApi: error);
      return null;
    }
  }

  Future<bool> editar(String id, {bool asignarPuertas = false}) async {
    if (state.enviando) return false;
    final error = DatosUsuario.errorDeEtiqueta(state.etiqueta);
    if (error != null) {
      state = state.copiar(errorDatos: error);
      return false;
    }
    state = state.copiar(enviando: true);
    try {
      final repositorio = ref.read(usuariosRepositorioProvider);
      await repositorio.editar(id, etiqueta: state.etiqueta.trim());
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
