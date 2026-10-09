import 'dart:async';

import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_refresco.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
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
  Future<bool> renovar() async {
    final refresco = await _almacen.leer();
    if (refresco == null) {
      await _caducar();
      return false;
    }
    try {
      final tokens = await _api.refrescar(refresco);
      await _guardarTokens(tokens.acceso, tokens.refresco);
      return true;
    } on ErrorApi catch (error) {
      if (error.code == 'sesion.refresco_invalido') await _caducar();
      return false;
    }
  }

  /// Al abrir la app: si hay un refresco guardado (móvil), restaura la sesión.
  Future<void> restaurar() async {
    if (await _almacen.leer() == null || !await renovar()) {
      state = const SinSesion();
      return;
    }
    try {
      await _cargarSesionActual();
    } on ErrorApi {
      // Sin red o con un fallo del servidor: se pide ingresar de nuevo, pero
      // el refresco se conserva para la próxima vez.
      state = const SinSesion();
    }
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

  /// Cambia el rol activo (ADR 0004). Si falla, la sesión queda como estaba.
  Future<void> elegirRol(String rolId) async {
    _acceso = await _api.cambiarRolActivo(rolId);
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

  Future<void> _cargarSesionActual() async {
    final actual = await _api.sesionActual();
    final rol = actual.rolActivo;
    if (rol == null) {
      // Al reabrir con un refresco guardado de una sesión que no eligió rol.
      state = SesionEligiendoRol(
        usuario: _usuario(actual.usuario),
        cuenta: _cuenta(actual.cuenta),
        roles: [
          for (final r in actual.roles) RolSesion(id: r.id, nombre: r.nombre),
        ],
      );
      return;
    }
    state = SesionAutenticada(
      usuario: _usuario(actual.usuario),
      cuenta: _cuenta(actual.cuenta),
      rolActivo: RolSesion(id: rol.id, nombre: rol.nombre),
      permisos: actual.permisos.toSet(),
    );
  }

  Future<void> _guardarTokens(String acceso, String refresco) async {
    _acceso = acceso;
    await _almacen.guardar(refresco);
  }

  /// Olvida la sesión en memoria y en el almacén (cierre o refresco rechazado).
  Future<void> _caducar() async {
    _acceso = null;
    await _almacen.borrar();
    state = const SinSesion();
  }
}

UsuarioSesion _usuario(UsuarioDto dto) =>
    UsuarioSesion(id: dto.id, etiqueta: dto.etiqueta);

CuentaSesion _cuenta(CuentaDto dto) =>
    CuentaSesion(id: dto.id, codigo: dto.codigo, nombre: dto.nombre);

/// Proveedor del estado de la sesión.
final NotifierProvider<SesionControlador, SesionEstado>
sesionControladorProvider = NotifierProvider<SesionControlador, SesionEstado>(
  SesionControlador.new,
);
