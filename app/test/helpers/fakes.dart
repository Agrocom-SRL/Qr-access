import 'dart:typed_data';

import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_refresco.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
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
}

/// Sesión autenticada con los permisos dados, para las pantallas con sesión.
SesionAutenticada sesionCon({Set<String> permisos = const {}}) =>
    SesionAutenticada(
      usuario: const UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
      cuenta: const CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
      rolActivo: const RolSesion(id: 'r1', nombre: 'Administrador'),
      permisos: permisos,
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
  new(this.puertas);

  final List<Puerta> puertas;

  @override
  Future<List<Puerta>> listarTodas() async => puertas;
}

class QrAccesosRepositorioFalso implements QrAccesosRepositorio {
  new({this.emitido, this.listado, this.errorEmitir, this.errorAnular});

  QrEmitido? emitido;
  Pagina<QrAcceso>? listado;
  Exception? errorEmitir;
  Exception? errorAnular;

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
    return listado ??
        Pagina(datos: const [], pagina: pagina, porPagina: porPagina, total: 0);
  }

  @override
  Future<void> anular(String id) async {
    if (errorAnular != null) throw errorAnular!;
    anulados.add(id);
  }
}

class EventosRepositorioFalso implements EventosRepositorio {
  new(this.pagina);

  final Pagina<EventoAcceso> pagina;

  @override
  Future<Pagina<EventoAcceso>> listar({
    required int pagina,
    required int porPagina,
  }) async => this.pagina;
}

/// Registra lo que se pidió compartir en vez de abrir el menú del sistema.
class CompartirFalso implements CompartirImagen {
  final List<({Uint8List bytes, String nombreArchivo, String texto})> enviados =
      [];

  @override
  Future<void> compartirPng({
    required Uint8List bytes,
    required String nombreArchivo,
    required String texto,
  }) async {
    enviados.add((bytes: bytes, nombreArchivo: nombreArchivo, texto: texto));
  }
}
