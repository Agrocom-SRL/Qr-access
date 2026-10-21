import 'dart:typed_data';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_qr.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_refresco.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/administracion/data/estructura_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/cupo.dart';
import 'package:agrocom_acceso/features/administracion/domain/estadisticas_usuarios.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/eventos/data/eventos_repositorio.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/features/perfil/data/perfil_repositorio.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';

/// Fakes con el mismo shape que devuelve la API (contrato común V1). Los tests
/// de pantalla y de controlador los usan en lugar de los repositorios reales.

/// Sesión de prueba: arranca en el estado que se le pasa, no toca la red y
/// anota las acciones que recibe para que el test las compruebe.
class SesionFalsa extends SesionControlador {
  new([this._estado = const SinSesion()]);

  final SesionEstado _estado;
  final List<RespuestaInicio> inicios = [];
  int cierres = 0;

  /// Error que lanza `adoptarInicio`, para probar los caminos de fallo.
  Exception? errorAlAdoptar;

  @override
  SesionEstado build() => _estado;

  @override
  Future<void> adoptarInicio(RespuestaInicio inicio) async {
    if (errorAlAdoptar != null) throw errorAlAdoptar!;
    inicios.add(inicio);
  }

  @override
  Future<void> cerrar() async => cierres++;
}

const usuarioDePrueba = UsuarioSesion(id: 'u1', etiqueta: 'Ana Pérez');
const cuentaDePrueba = CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo');
const rolDePrueba = RolSesion(id: 'r1', nombre: 'Administrador');

/// Sesión autenticada con los permisos dados, para las pantallas con sesión.
SesionAutenticada sesionCon({
  Set<String> permisos = const {},
  SuscripcionSesion? suscripcion,
  RolSesion rol = rolDePrueba,
}) => SesionAutenticada(
  usuario: usuarioDePrueba,
  cuenta: cuentaDePrueba,
  rolActivo: rol,
  permisos: permisos,
  suscripcion: suscripcion,
);

/// Almacén del refresco en memoria, sin plugin de plataforma.
class AlmacenRefrescoFalso implements AlmacenRefresco {
  new([this.refresco]);

  String? refresco;

  @override
  Future<String?> leer() async => refresco;

  @override
  Future<void> guardar(String refresco) async => this.refresco = refresco;

  @override
  Future<void> borrar() async => refresco = null;
}

/// Preferencias en memoria.
class AlmacenPreferenciasFalso implements AlmacenPreferencias {
  final Map<String, String> valores = {};

  @override
  Future<String?> leer(String clave) async => valores[clave];

  @override
  Future<void> guardar(String clave, String valor) async =>
      valores[clave] = valor;

  @override
  Future<void> borrar(String clave) async => valores.remove(clave);
}

class SesionRepositorioFalso implements SesionRepositorio {
  new({this.respuesta, this.error});

  final RespuestaInicio? respuesta;

  /// Error que lanza `iniciar`, para probar los caminos de fallo.
  final Exception? error;
  final List<Pin> pinesRecibidos = [];

  @override
  Future<RespuestaInicio> iniciar(Pin pin) async {
    pinesRecibidos.add(pin);
    if (error != null) throw error!;
    return respuesta!;
  }
}

class PuertasRepositorioFalso implements PuertasRepositorio {
  new(this.puertas, {this.error});

  final List<Puerta> puertas;
  final Exception? error;

  @override
  Future<List<Puerta>> listarTodas() async {
    if (error != null) throw error!;
    return puertas;
  }
}

class QrAccesosRepositorioFalso implements QrAccesosRepositorio {
  new({
    this.emitido,
    this.listado,
    this.resumen = const {},
    this.errorEmitir,
    this.errorAnular,
    this.errorListar,
    this.respaldo,
  });

  QrEmitido? emitido;

  /// Lo que devuelve el respaldo sin internet del QR propio.
  QrEmitido? respaldo;
  Pagina<QrAcceso>? listado;
  Map<EstadoQr, int> resumen;
  Exception? errorEmitir;
  Exception? errorAnular;
  Exception? errorListar;

  final List<DatosEmision> emisiones = [];
  final List<DateTime> ahoras = [];
  final List<EstadoQr> estadosListados = [];
  final List<String> anulados = [];

  @override
  Future<QrEmitido> emitir(
    DatosEmision datos, {
    required DateTime ahora,
  }) async {
    emisiones.add(datos);
    ahoras.add(ahora);
    if (errorEmitir != null) throw errorEmitir!;
    return emitido!;
  }

  @override
  Future<Pagina<QrAcceso>> listar({
    required EstadoQr estado,
    required int pagina,
    required int porPagina,
  }) async {
    estadosListados.add(estado);
    if (errorListar != null) throw errorListar!;
    return listado ??
        Pagina(datos: const [], pagina: pagina, porPagina: porPagina, total: 0);
  }

  @override
  Future<Map<EstadoQr, int>> resumir() async => resumen;

  /// Lo que responde el seguimiento de cualquier QR; `null` simula sin red.
  SeguimientoQr? seguimiento;

  @override
  Future<SeguimientoQr> seguir(String id) async {
    final actual = seguimiento;
    if (actual == null) throw Exception('sin seguimiento');
    return actual;
  }

  @override
  Future<void> anular(String id) async {
    if (errorAnular != null) throw errorAnular!;
    anulados.add(id);
  }

  @override
  Future<QrEmitido?> ultimoPropioGuardado() async => respaldo;
}

class EventosRepositorioFalso implements EventosRepositorio {
  new(
    this.pagina, {
    this.resumen = const ResumenEventos(
      permitidos: 0,
      rechazados: 0,
      rechazadosPorMotivo: {},
    ),
    this.error,
  });

  final Pagina<EventoAcceso> pagina;
  final ResumenEventos resumen;
  final Exception? error;
  final List<FiltroEventos> filtrosPedidos = [];

  @override
  Future<Pagina<EventoAcceso>> listar({
    required FiltroEventos filtro,
    required int pagina,
    required int porPagina,
  }) async {
    filtrosPedidos.add(filtro);
    if (error != null) throw error!;
    return this.pagina;
  }

  @override
  Future<ResumenEventos> resumir(FiltroEventos filtro) async {
    if (error != null) throw error!;
    return resumen;
  }
}

class PerfilRepositorioFalso implements PerfilRepositorio {
  final List<String> nombres = [];

  @override
  Future<void> cambiarNombre(String nombre) async => nombres.add(nombre);
}

class EstructuraRepositorioFalso implements EstructuraRepositorio {
  new(this.sitios, {this.error});

  final List<SitioGestionado> sitios;
  final Exception? error;
  final List<DatosSitio> sitiosCreados = [];
  final List<(String, DatosPuerta)> puertasCreadas = [];
  final List<String> puertasEliminadas = [];
  final List<String> sitiosEliminados = [];

  @override
  Future<List<SitioGestionado>> listar() async {
    if (error != null) throw error!;
    return sitios;
  }

  @override
  Future<void> crearSitio(DatosSitio datos) async => sitiosCreados.add(datos);

  @override
  Future<void> editarSitio(String id, DatosSitio datos) async {}

  @override
  Future<void> eliminarSitio(String id) async => sitiosEliminados.add(id);

  @override
  Future<void> crearPuerta(String sitioId, DatosPuerta datos) async =>
      puertasCreadas.add((sitioId, datos));

  @override
  Future<void> editarPuerta(String id, DatosPuerta datos) async {}

  @override
  Future<void> eliminarPuerta(String id) async => puertasEliminadas.add(id);
}

class UsuariosRepositorioFalso implements UsuariosRepositorio {
  new({
    this.usuarios = const [],
    this.rolesDisponibles = const [],
    this.pinGenerado,
    this.error,
    this.asignadas = const PuertasAsignadas(),
    this.dependientes = const {},
    this.estadisticasActuales = const EstadisticasDeUsuarios(
      ventanaDias: 30,
      umbralInactivoDias: 30,
      umbralRuidosoPorDia: 10,
      usuarios: [],
      titulares: [],
    ),
    this.cupoActual = const Cupo(
      usados: 4,
      maximo: 10,
      porcentaje: 40,
      aviso: null,
      maxMiembrosPorTitular: 10,
    ),
  });

  /// Cuántos usuarios cuelgan de cada usuario: sin `confirmar`, eliminarlo
  /// responde 409 con esa cantidad, como la API.
  final Map<String, int> dependientes;
  final Cupo cupoActual;
  final EstadisticasDeUsuarios estadisticasActuales;
  final List<String> eliminadosEnCascada = [];
  final List<Usuario> usuarios;
  final PuertasAsignadas asignadas;
  final List<(String, PuertasAsignadas)> asignaciones = [];
  final List<String?> sufijosPedidos = [];
  final List<Rol> rolesDisponibles;
  final PinGenerado? pinGenerado;
  final Exception? error;
  final List<DatosUsuario> creados = [];
  final List<(String, String)> editados = [];
  final List<String> eliminados = [];
  final List<String> pinesRegenerados = [];

  @override
  Future<Pagina<Usuario>> listar({
    required int pagina,
    required int porPagina,
  }) async {
    if (error != null) throw error!;
    return Pagina(
      datos: usuarios,
      pagina: 1,
      porPagina: porPagina,
      total: usuarios.length,
    );
  }

  @override
  Future<List<Rol>> roles() async => rolesDisponibles;

  @override
  Future<PinGenerado> crear(DatosUsuario datos) async {
    if (error != null) throw error!;
    creados.add(datos);
    return pinGenerado!;
  }

  @override
  Future<Usuario> editar(String id, {required String etiqueta}) async {
    if (error != null) throw error!;
    editados.add((id, etiqueta));
    return usuarios.firstWhere((u) => u.id == id);
  }

  @override
  Future<void> eliminar(String id, {bool confirmar = false}) async {
    if (error != null) throw error!;
    final cantidad = dependientes[id] ?? 0;
    if (cantidad > 0 && !confirmar) {
      throw ErrorApi(
        code: 'usuario.con_dependientes',
        status: 409,
        detalles: {'dependientes': cantidad},
      );
    }
    eliminados.add(id);
    if (confirmar) eliminadosEnCascada.add(id);
  }

  @override
  Future<Cupo> cupo() async => cupoActual;

  @override
  Future<EstadisticasDeUsuarios> estadisticas() async {
    if (error != null) throw error!;
    return estadisticasActuales;
  }

  @override
  Future<PinGenerado> generarPin(Usuario usuario, {String? sufijo}) async {
    if (error != null) throw error!;
    pinesRegenerados.add(usuario.id);
    sufijosPedidos.add(sufijo);
    return pinGenerado!;
  }

  @override
  Future<PuertasAsignadas> puertasAsignadas(String usuarioId) async {
    if (error != null) throw error!;
    return asignadas;
  }

  @override
  Future<void> asignarPuertas(
    String usuarioId,
    PuertasAsignadas puertas,
  ) async {
    if (error != null) throw error!;
    asignaciones.add((usuarioId, puertas));
  }
}

/// Registra lo que se pidió compartir en vez de abrir el menú del sistema.
class CompartirFalso implements CompartirImagen {
  new([this.resultado = ResultadoCompartir.compartido]);

  final ResultadoCompartir resultado;
  final List<({Uint8List bytes, String nombreArchivo, String texto})> enviados =
      [];

  @override
  Future<ResultadoCompartir> compartirPng({
    required Uint8List bytes,
    required String nombreArchivo,
    required String texto,
  }) async {
    enviados.add((bytes: bytes, nombreArchivo: nombreArchivo, texto: texto));
    return resultado;
  }
}

/// Almacén de QR emitidos en memoria, sin vencimiento automático.
class AlmacenQrEnMemoria implements AlmacenQr {
  final Map<String, String> _textos = {};

  @override
  Future<String?> leer(String id) async => _textos[id];

  @override
  Future<void> guardar(String id, String texto, DateTime venceAt) async =>
      _textos[id] = texto;

  @override
  Future<void> borrar(String id) async => _textos.remove(id);

  QrPropioGuardado? ultimoPropio;

  @override
  Future<QrPropioGuardado?> leerUltimoPropio() async => ultimoPropio;

  @override
  Future<void> guardarUltimoPropio(QrPropioGuardado qr) async =>
      ultimoPropio = qr;

  @override
  Future<void> borrarUltimoPropio(String id) async {
    if (ultimoPropio?.id == id) ultimoPropio = null;
  }
}
