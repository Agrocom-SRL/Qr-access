import 'package:flutter/foundation.dart';

/// Estado de la sesión que leen el router, los menús y los permisos.
/// Inmutable: cada cambio emite un estado nuevo.
@immutable
sealed class SesionEstado {
  const new();
}

/// Al abrir la app, mientras se renueva la sesión guardada (móvil).
final class SesionArrancando extends SesionEstado {
  const new();
}

/// Sin usuario: se muestra la bienvenida y el inicio de sesión.
final class SinSesion extends SesionEstado {
  const new();
}

/// El PIN es válido pero el usuario tiene varios roles y no eligió uno
/// (ADR 0004: un rol activo por sesión).
final class SesionEligiendoRol extends SesionEstado {
  const new({
    required this.usuario,
    required this.cuenta,
    required this.roles,
    this.rolPreferidoId,
  });

  final UsuarioSesion usuario;
  final CuentaSesion cuenta;
  final List<RolSesion> roles;

  /// El último rol usado, para dejarlo preseleccionado (handoff C03).
  final String? rolPreferidoId;
}

/// Sesión con rol activo. Los permisos son los del rol activo, nunca la unión
/// de todos los roles (ADR 0004).
final class SesionAutenticada extends SesionEstado {
  const new({
    required this.usuario,
    required this.cuenta,
    required this.rolActivo,
    required this.permisos,
    this.roles = const [],
    this.suscripcion,
  });

  final UsuarioSesion usuario;
  final CuentaSesion cuenta;
  final RolSesion rolActivo;
  final Set<String> permisos;

  /// Todos los roles del usuario, para "Cambiar rol" desde Perfil.
  final List<RolSesion> roles;

  /// Plan y vencimiento vigentes (HU-03); `null` sin suscripción vigente.
  final SuscripcionSesion? suscripcion;

  bool get tieneVariosRoles => roles.length > 1;
}

/// Si la sesión tiene `permiso` con su rol activo. Sin sesión autenticada,
/// nunca: lo que no se puede usar no se muestra (ADR 0004).
extension PermisosDeSesion on SesionEstado {
  bool tiene(String permiso) => switch (this) {
    SesionAutenticada(:final permisos) => permisos.contains(permiso),
    _ => false,
  };
}

/// Usuario de la cuenta (un PIN con su etiqueta, ADR 0018).
@immutable
class UsuarioSesion {
  const new({required this.id, required this.etiqueta});

  final String id;

  /// `null` cuando el PIN no tiene etiqueta.
  final String? etiqueta;
}

@immutable
class CuentaSesion {
  const new({required this.id, required this.codigo, required this.nombre});

  final String id;
  final String codigo;
  final String nombre;
}

@immutable
class RolSesion {
  const new({required this.id, required this.nombre});

  final String id;
  final String nombre;
}

@immutable
class SuscripcionSesion {
  const new({required this.plan, required this.hasta});

  final String plan;

  /// Vencimiento en UTC.
  final DateTime hasta;
}

/// Lo que devuelve el inicio de sesión, ya convertido del contrato.
@immutable
class RespuestaInicio {
  const new({
    required this.acceso,
    required this.refresco,
    required this.usuario,
    required this.cuenta,
    required this.roles,
    required this.rolActivoId,
  });

  final String acceso;
  final String refresco;
  final UsuarioSesion usuario;
  final CuentaSesion cuenta;
  final List<RolSesion> roles;

  /// `null` cuando el usuario debe elegir rol.
  final String? rolActivoId;
}
