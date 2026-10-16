import 'dart:async';

import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_cache.dart';
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

  /// La sesión que estaba activa al pedir "Cambiar rol": a ella se vuelve si la
  /// persona se arrepiente (atrás) o no hay internet para cambiar.
  SesionAutenticada? _previaAlCambiarRol;

  ClienteApi get _api => ref.read(clienteApiProvider);
  AlmacenRefresco get _almacen => ref.read(almacenRefrescoProvider);
  AlmacenPreferencias get _preferencias =>
      ref.read(almacenPreferenciasProvider);

  /// ¿Se puede volver a la sesión anterior desde la pantalla de elegir rol?
  bool get puedeCancelarCambioDeRol => _previaAlCambiarRol != null;

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
    if (refresco == null) {
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

  /// Al abrir la app: si hay un refresco guardado (móvil), restaura la sesión.
  /// Sin internet no se cierra: se entra con la última sesión guardada (mismo
  /// rol y permisos) y los datos se actualizan cuando vuelva la red.
  Future<void> restaurar() async {
    if (await _almacen.leer() == null) {
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

  /// Adopta los tokens de un inicio de sesión exitoso. Sin rol activo, el
  /// usuario debe elegir uno antes de entrar.
  Future<void> adoptarInicio(RespuestaInicio inicio) async {
    await _guardarTokens(inicio.acceso, inicio.refresco);
    if (inicio.rolActivoId == null) {
      state = SesionEligiendoRol(
        usuario: inicio.usuario,
        cuenta: inicio.cuenta,
        roles: inicio.roles,
      );
      return;
    }
    try {
      await _cargarSesionActual();
    } on ErrorApi {
      await _caducar();
      rethrow;
    }
  }

  /// Cambia el rol activo (ADR 0004). Si falla (p. ej. sin internet), la
  /// sesión queda como estaba y se sigue en la pantalla con el error.
  Future<void> elegirRol(String rolId) async {
    final nuevoAcceso = await _api.cambiarRolActivo(rolId);
    _acceso = nuevoAcceso;
    _previaAlCambiarRol = null;
    await _cargarSesionActual();
  }

  /// Cierra la sesión en la API y la borra del dispositivo. Si la API no
  /// responde, la app igual olvida la sesión: no debe quedar sesión a medias.
  Future<void> cerrar() async {
    if (_acceso != null) {
      try {
        await _api.cerrarSesion();
      } on ErrorApi {
        // El servidor ya no tiene la sesión o no responde; el acceso expira
        // solo.
      }
    }
    await _caducar();
  }

  /// Vuelve a elegir rol sin cerrar la sesión (Perfil › "Cambiar rol"). El
  /// rol activo queda como preferido hasta que se elija otro.
  void pedirCambioDeRol() {
    final actual = state;
    if (actual is! SesionAutenticada || !actual.tieneVariosRoles) return;
    _previaAlCambiarRol = actual;
    state = SesionEligiendoRol(
      usuario: actual.usuario,
      cuenta: actual.cuenta,
      roles: actual.roles,
      rolPreferidoId: actual.rolActivo.id,
    );
  }

  /// Deja "Cambiar rol" sin elegir y vuelve a la sesión que había (atrás): no
  /// se cierra la sesión ni se pierde el rol.
  void cancelarCambioDeRol() {
    final previa = _previaAlCambiarRol;
    if (previa == null || state is! SesionEligiendoRol) return;
    _previaAlCambiarRol = null;
    state = previa;
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
    final roles = [
      for (final r in actual.roles) RolSesion(id: r.id, nombre: r.nombre),
    ];
    if (rol == null) {
      // Al reabrir con un refresco guardado de una sesión que no eligió rol.
      state = SesionEligiendoRol(
        usuario: _usuario(actual.usuario),
        cuenta: _cuenta(actual.cuenta),
        roles: roles,
      );
      return;
    }
    final suscripcion = actual.suscripcion;
    final autenticada = SesionAutenticada(
      usuario: _usuario(actual.usuario),
      cuenta: _cuenta(actual.cuenta),
      rolActivo: RolSesion(id: rol.id, nombre: rol.nombre),
      permisos: actual.permisos.toSet(),
      roles: roles,
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

  Future<void> _guardarTokens(String acceso, String refresco) async {
    _acceso = acceso;
    await _almacen.guardar(refresco);
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
    _previaAlCambiarRol = null;
    await _almacen.borrar();
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
