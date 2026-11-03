import 'dart:async';

import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_cache.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_pin.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_refresco.dart';
import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/sesion/sesion_guardada.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Dueño de la sesión: guarda el acceso en memoria, el refresco en el almacén
/// de la plataforma y publica el `SesionEstado` que leen el router y los menús.
///
/// Los widgets no lo llaman directamente para red: lo usan los controladores
/// de `features/sesion` y el interceptor de `core/api`.
class SesionControlador extends Notifier<SesionEstado>
    implements ProveedorTokens {
  String? _acceso;

  ClienteApi get _api => ref.read(clienteApiProvider);
  AlmacenRefresco get _almacen => ref.read(almacenRefrescoProvider);
  AlmacenPin get _almacenPin => ref.read(almacenPinProvider);
  AlmacenPreferencias get _preferencias =>
      ref.read(almacenPreferenciasProvider);

  @override
  SesionEstado build() {
    // Diferido: la renovación usa el cliente HTTP, que todavía se está creando.
    unawaited(Future.microtask(restaurar));
    return const SesionArrancando();
  }

  @override
  String? get acceso => _acceso;

  /// Renueva el par de tokens con el refresco guardado (refresco rotativo).
  /// Si el servidor rechaza el refresco, la sesión se cierra; si no hay red,
  /// la sesión se conserva para reintentar.
  @override
  Future<bool> renovar() async =>
      await _renovar() == _ResultadoRenovacion.hecha;

  Future<_ResultadoRenovacion> _renovar() async {
    final refresco = await _almacen.leer();
    // En web no hay nada que leer: el refresco está en la cookie y la API lo
    // encuentra sola. Sin refresco en móvil, no hay nada que renovar.
    if (refresco == null && !_almacen.viveEnCookie) {
      await _caducar();
      return _ResultadoRenovacion.rechazada;
    }
    try {
      final tokens = await _api.refrescar(refresco);
      await _guardarTokens(tokens.acceso, tokens.refresco);
      return _ResultadoRenovacion.hecha;
    } on ErrorApi catch (error) {
      if (error.code == 'sesion.refresco_invalido') {
        await _caducar();
        return _ResultadoRenovacion.rechazada;
      }
      return error.esSinConexion
          ? _ResultadoRenovacion.sinRed
          : _ResultadoRenovacion.fallida;
    }
  }

  /// Al abrir la app: si hay un refresco guardado (móvil) o una cookie de
  /// refresco (web), restaura la sesión. Sin internet no se cierra: se entra
  /// con la última sesión guardada (mismo rol y permisos) y los datos se
  /// actualizan cuando vuelva la red.
  ///
  /// En web no se puede saber si hay cookie sin preguntar a la API: la cookie
  /// es `HttpOnly`. Por eso se pide la renovación siempre; un visitante sin
  /// cookie recibe un 401 y pasa a `SinSesion`.
  Future<void> restaurar() async {
    if (!_almacen.viveEnCookie && await _almacen.leer() == null) {
      state = const SinSesion();
      return;
    }
    switch (await _renovar()) {
      case _ResultadoRenovacion.rechazada:
        state = const SinSesion();
      case _ResultadoRenovacion.sinRed:
        await _entrarConSesionGuardada();
      case _ResultadoRenovacion.fallida:
        // Fallo del servidor: el refresco se conserva para la próxima vez.
        state = const SinSesion();
      case _ResultadoRenovacion.hecha:
        try {
          await _cargarSesionActual();
        } on ErrorApi catch (error) {
          if (error.esSinConexion) {
            await _entrarConSesionGuardada();
          } else if (error.code == 'sesion.sin_rol') {
            // Sin rol vigente no hay nada que restaurar: cada arranque
            // repetiría lo mismo.
            await _caducar();
          } else {
            state = const SinSesion();
          }
        }
    }
  }

  /// Usa la última sesión conocida; si no hay (primera vez o dañada), pide
  /// ingresar sin borrar el refresco.
  Future<void> _entrarConSesionGuardada() async {
    final texto = await _preferencias.leer(claveSesionGuardada);
    final guardada = texto == null ? null : decodificarSesion(texto);
    state = guardada ?? const SinSesion();
  }

  /// Adopta los tokens de un inicio de sesión exitoso. Un usuario sin rol
  /// vigente no entra: no tendría permisos para nada (ADR 0028).
  Future<void> adoptarInicio(RespuestaInicio inicio) async {
    await _guardarTokens(inicio.acceso, inicio.refresco);
    if (inicio.rolActivoId == null) {
      await _caducar();
      throw const ErrorApi(code: 'sesion.sin_rol');
    }
    try {
      await _cargarSesionActual();
    } on ErrorApi {
      await _caducar();
      rethrow;
    }
  }

  /// Cierra la sesión en la API y la borra del dispositivo. Si la API no
  /// responde, la app igual olvida la sesión: no debe quedar sesión a medias.
  ///
  /// En web puede no haber acceso en memoria (sesión restaurada sin red o tras
  /// recargar) y aun así quedar la cookie: hay que llamar a la API igualmente,
  /// porque es la que la borra. El interceptor renueva el acceso si hace falta.
  Future<void> cerrar() async {
    if (_acceso != null || _almacen.viveEnCookie) {
      try {
        await _api.cerrarSesion();
      } on ErrorApi {
        // El servidor ya no tiene la sesión o no responde; el acceso expira
        // solo.
      }
    }
    await _caducar();
  }

  /// Vuelve a pedir la sesión a la API (p. ej. tras un cambio de plan).
  Future<void> refrescarDatos() async {
    if (_acceso == null) return;
    try {
      await _cargarSesionActual();
    } on ErrorApi {
      // Sin red: se conserva lo que ya se tenía.
    }
  }

  Future<void> _cargarSesionActual() async {
    final actual = await _api.sesionActual();
    final rol = actual.rolActivo;
    // Sin rol vigente (p. ej. se lo quitaron): ya no tiene permisos para nada.
    if (rol == null) throw const ErrorApi(code: 'sesion.sin_rol');
    final suscripcion = actual.suscripcion;
    final autenticada = SesionAutenticada(
      usuario: _usuario(actual.usuario),
      cuenta: _cuenta(actual.cuenta),
      rolActivo: RolSesion(id: rol.id, nombre: rol.nombre),
      permisos: actual.permisos.toSet(),
      suscripcion: suscripcion == null
          ? null
          : SuscripcionSesion(plan: suscripcion.plan, hasta: suscripcion.hasta),
    );
    state = autenticada;
    await _preferencias.guardar(
      claveSesionGuardada,
      codificarSesion(autenticada),
    );
  }

  /// En web el refresco no llega en el cuerpo (`refresco` es `null`): ya quedó
  /// en la cookie y no se guarda nada aquí.
  Future<void> _guardarTokens(String acceso, String? refresco) async {
    _acceso = acceso;
    if (refresco != null) await _almacen.guardar(refresco);
  }

  /// Vacía lo guardado para el modo sin conexión: el siguiente que ingrese en
  /// este teléfono no debe ver datos de otra persona ni de otra cuenta.
  Future<void> _olvidarCache() async {
    try {
      await ref.read(almacenCacheProvider).borrarTodo();
    } on Object {
      // Sin caché que borrar (o ilegible): no impide cerrar la sesión.
    }
    ref.read(datosGuardadosProvider.notifier).descartar();
  }

  /// Olvida la sesión en memoria y en el almacén (cierre o refresco rechazado).
  Future<void> _caducar() async {
    _acceso = null;
    await _almacen.borrar();
    try {
      await _almacenPin.borrar();
    } on Object {
      // Sin almacén seguro disponible no hay PIN que borrar.
    }
    await _preferencias.borrar(claveSesionGuardada);
    await _olvidarCache();
    state = const SinSesion();
  }
}

UsuarioSesion _usuario(UsuarioDto dto) =>
    UsuarioSesion(id: dto.id, etiqueta: dto.etiqueta);

CuentaSesion _cuenta(CuentaDto dto) =>
    CuentaSesion(id: dto.id, codigo: dto.codigo, nombre: dto.nombre);

/// Resultado de renovar el par de tokens: distingue "sin red" de "rechazado".
enum _ResultadoRenovacion { hecha, rechazada, sinRed, fallida }

/// Proveedor del estado de la sesión.
final NotifierProvider<SesionControlador, SesionEstado>
sesionControladorProvider = NotifierProvider<SesionControlador, SesionEstado>(
  SesionControlador.new,
);
