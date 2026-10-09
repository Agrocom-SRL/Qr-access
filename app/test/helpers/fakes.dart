import 'dart:typed_data';

import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_refresco.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/eventos/data/eventos_repositorio.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
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
  final List<String> rolesElegidos = [];
  int cierres = 0;
  int cambiosDeRolPedidos = 0;

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
  Future<void> elegirRol(String rolId) async => rolesElegidos.add(rolId);

  @override
  Future<void> cerrar() async => cierres++;

  @override
  void pedirCambioDeRol() {
    cambiosDeRolPedidos++;
    super.pedirCambioDeRol();
  }
}

const usuarioDePrueba = UsuarioSesion(id: 'u1', etiqueta: 'Ana Pérez');
const cuentaDePrueba = CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo');
const rolDePrueba = RolSesion(id: 'r1', nombre: 'Administrador');

/// Sesión autenticada con los permisos dados, para las pantallas con sesión.
SesionAutenticada sesionCon({
  Set<String> permisos = const {},
  List<RolSesion> roles = const [rolDePrueba],
  SuscripcionSesion? suscripcion,
}) => SesionAutenticada(
  usuario: usuarioDePrueba,
  cuenta: cuentaDePrueba,
  rolActivo: rolDePrueba,
  permisos: permisos,
  roles: roles,
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
  });

  QrEmitido? emitido;
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

  @override
  Future<void> anular(String id) async {
    if (errorAnular != null) throw errorAnular!;
    anulados.add(id);
  }
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

class UsuariosRepositorioFalso implements UsuariosRepositorio {
  new({
    this.usuarios = const [],
    this.rolesDisponibles = const [],
    this.pinGenerado,
    this.error,
  });

  final List<Usuario> usuarios;
  final List<Rol> rolesDisponibles;
  final PinGenerado? pinGenerado;
  final Exception? error;
  final List<DatosUsuario> creados = [];
  final List<(String, DatosUsuario)> editados = [];
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
  Future<Usuario> editar(String id, DatosUsuario datos) async {
    if (error != null) throw error!;
    editados.add((id, datos));
    return usuarios.firstWhere((u) => u.id == id);
  }

  @override
  Future<void> eliminar(String id) async {
    if (error != null) throw error!;
    eliminados.add(id);
  }

  @override
  Future<PinGenerado> generarPin(Usuario usuario) async {
    if (error != null) throw error!;
    pinesRegenerados.add(usuario.id);
    return pinGenerado!;
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
