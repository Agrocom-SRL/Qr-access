import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sincronizacion/controlador_sincronizacion.dart';
import 'package:agrocom_acceso/core/sincronizacion/estado_sincronizacion.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/cupo.dart';
import 'package:agrocom_acceso/features/administracion/domain/estadisticas_usuarios.dart';
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

/// Inactivos, ruidosos y Titulares cerca del tope de la rama (ADR 0028 §4):
/// solo se pide con `seguridad.estadistica.ver`.
final FutureProvider<EstadisticasDeUsuarios> estadisticasProvider =
    FutureProvider.autoDispose<EstadisticasDeUsuarios>(
      (ref) => ref.watch(usuariosRepositorioProvider).estadisticas(),
    );

/// Sincronización de la actividad de usuarios (ver
/// `ControladorSincronizacion`): vuelve a pedir las estadísticas con el gesto
/// de tirar hacia abajo y en segundo plano. Sin botón de actualizar.
class SincronizacionEstadisticasControlador extends ControladorSincronizacion {
  @override
  Future<void> recargarListado() async {
    ref.invalidate(estadisticasProvider);
    await ref.read(estadisticasProvider.future);
  }
}

/// Estado de sincronización de la actividad, que se descarta al salir de la
/// pantalla (y con él, el refresco en segundo plano).
final NotifierProvider<
  SincronizacionEstadisticasControlador,
  EstadoSincronizacion
>
sincronizacionEstadisticasProvider =
    NotifierProvider.autoDispose<
      SincronizacionEstadisticasControlador,
      EstadoSincronizacion
    >(SincronizacionEstadisticasControlador.new);

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
  Future<ErrorApi?> eliminar(String usuarioId, {bool confirmar = false}) async {
    state = usuarioId;
    try {
      await ref
          .read(usuariosRepositorioProvider)
          .eliminar(usuarioId, confirmar: confirmar);
      ref
        ..invalidate(usuariosProvider)
        ..invalidate(cupoProvider)
        ..invalidate(estadisticasProvider);
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
    this.errores = const {},
    this.errorApi,
    this.guardado = false,
    this.elegirSufijo = false,
    this.sufijo = '',
    this.puertas = const PuertasAsignadas(todas: true),
    this.puertasCargadas = false,
    this.puertasNoCargadas = false,
  });

  final String etiqueta;

  /// El único rol del usuario nuevo (ADR 0028).
  final Rol? rol;

  /// Propiedad y nombre de la unidad: solo para un Titular.
  final String? sitioId;
  final String unidad;
  final bool enviando;

  /// Todos los campos que faltan o no son válidos; cada uno se marca en su
  /// sitio del formulario.
  final Set<ErrorDatosUsuario> errores;
  final ErrorApi? errorApi;

  /// En edición: se guardó y el formulario sigue abierto (guía §2.3).
  final bool guardado;

  /// El administrador escribe los 4 caracteres del PIN en vez de sortearlos.
  final bool elegirSufijo;
  final String sufijo;

  /// Puertas asignadas. Un alta nuevo viene con todas marcadas (el
  /// administrador desmarca solo si quiere restringir). Al editar se espera a
  /// leer lo guardado: `puertasCargadas` evita pisar la asignación real con
  /// una vacía, y `puertasNoCargadas` avisa si la lectura falló.
  final PuertasAsignadas puertas;
  final bool puertasCargadas;
  final bool puertasNoCargadas;

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
    Set<ErrorDatosUsuario>? errores,
    ErrorApi? errorApi,
    bool guardado = false,
    bool? elegirSufijo,
    String? sufijo,
    PuertasAsignadas? puertas,
    bool? puertasCargadas,
    bool? puertasNoCargadas,
  }) => FormularioUsuarioEstado(
    etiqueta: etiqueta ?? this.etiqueta,
    rol: sinRol ? null : rol ?? this.rol,
    sitioId: sinSitio ? null : sitioId ?? this.sitioId,
    unidad: unidad ?? this.unidad,
    enviando: enviando,
    errores: errores ?? this.errores,
    errorApi: errorApi,
    guardado: guardado,
    elegirSufijo: elegirSufijo ?? this.elegirSufijo,
    sufijo: sufijo ?? this.sufijo,
    puertas: puertas ?? this.puertas,
    puertasCargadas: puertasCargadas ?? this.puertasCargadas,
    puertasNoCargadas: puertasNoCargadas ?? this.puertasNoCargadas,
  );

  /// Quita de los errores los que ya se corrigieron: al escribir o elegir en
  /// un campo, su error desaparece y el resto se queda.
  FormularioUsuarioEstado sinErrores(Set<ErrorDatosUsuario> corregidos) =>
      copiar(errores: errores.difference(corregidos));
}

/// Crear o editar un usuario (HU-06). Crear devuelve el PIN para mostrarlo
/// una sola vez.
class FormularioUsuarioControlador extends Notifier<FormularioUsuarioEstado> {
  @override
  FormularioUsuarioEstado build() => const FormularioUsuarioEstado();

  /// Al editar solo cuenta el nombre: el rol y la unidad no se tocan. Las
  /// puertas se leen aparte: hasta entonces no hay nada marcado.
  void cargar(Usuario usuario) => state = FormularioUsuarioEstado(
    etiqueta: usuario.etiqueta ?? '',
    puertas: const PuertasAsignadas(),
  );

  static const Set<ErrorDatosUsuario> _erroresDeEtiqueta = {
    ErrorDatosUsuario.sinEtiqueta,
    ErrorDatosUsuario.etiquetaLarga,
  };

  void cambiarEtiqueta(String etiqueta) =>
      state = state.copiar(etiqueta: etiqueta).sinErrores(_erroresDeEtiqueta);

  void alternarSufijoElegido({required bool elegir}) =>
      state = state.copiar(elegirSufijo: elegir, sufijo: '');

  void cambiarSufijo(String sufijo) => state = state
      .copiar(sufijo: sufijo)
      .sinErrores({ErrorDatosUsuario.sufijoInvalido});

  /// Las puertas que ya tiene asignadas el usuario que se edita.
  void cargarPuertas(PuertasAsignadas puertas) => state = state.copiar(
    puertas: puertas,
    puertasCargadas: true,
    puertasNoCargadas: false,
  );

  /// La lectura de las puertas del usuario que se edita falló: no se marca
  /// nada y guardar no las toca.
  void fallarCargaDePuertas() => state = state.copiar(puertasNoCargadas: true);

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
    state = state
        .copiar(
          rol: rol,
          sinSitio: !esTitular,
          unidad: esTitular ? state.unidad : '',
        )
        .sinErrores({ErrorDatosUsuario.sinRol});
  }

  void elegirPropiedad(String? sitioId) => state =
      (sitioId == null
              ? state.copiar(sinSitio: true)
              : state.copiar(sitioId: sitioId))
          .sinErrores({ErrorDatosUsuario.sinPropiedad});

  void cambiarUnidad(String unidad) =>
      state = state.copiar(unidad: unidad).sinErrores({
        ErrorDatosUsuario.sinNombreDeUnidad,
        ErrorDatosUsuario.nombreDeUnidadLargo,
      });

  /// Los errores del alta (todos a la vez), o `null` si los datos son válidos.
  /// Quedan en el estado para marcar cada campo.
  DatosUsuario? _validarAlta() {
    final errores = {
      ...DatosUsuario.erroresDe(
        etiqueta: state.etiqueta,
        rolId: state.rol?.id,
        nivel: state.nivel,
        sitioId: state.sitioId,
        unidad: state.unidad,
      ),
      if (state.elegirSufijo && !sufijoDePinValido(state.sufijo))
        ErrorDatosUsuario.sufijoInvalido,
    };
    if (errores.isNotEmpty) {
      state = state.copiar(errores: errores);
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
    state = state.copiar(enviando: true, errores: const {});
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
        ..invalidate(cupoProvider)
        ..invalidate(estadisticasProvider);
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
      state = state.copiar(errores: {error});
      return false;
    }
    state = state.copiar(enviando: true, errores: const {});
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
