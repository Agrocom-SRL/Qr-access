import 'package:flutter/foundation.dart';

/// Un rol de la cuenta, para asignarlo (HU-06).
@immutable
class Rol {
  const new({required this.id, required this.nombre});

  final String id;
  final String nombre;
}

/// Un usuario (PIN) de la cuenta, como lo administra el administrador. Nunca
/// trae el PIN: ese se ve una sola vez al generarlo (ADR 0018 §3).
@immutable
class Usuario {
  const new({
    required this.id,
    required this.etiqueta,
    required this.activo,
    required this.roles,
    required this.pinGeneradoAt,
    required this.ultimoIngresoAt,
    required this.creadoAt,
  });

  final String id;
  final String? etiqueta;
  final bool activo;
  final List<Rol> roles;
  final DateTime? pinGeneradoAt;
  final DateTime? ultimoIngresoAt;
  final DateTime creadoAt;
}

/// Un PIN recién generado, para mostrarlo una sola vez (C10c/E10b).
@immutable
class PinGenerado {
  const new({
    required this.pin,
    required this.usuarioEtiqueta,
    required this.roles,
    required this.esNuevo,
    this.usuarioId,
  });

  /// Los 7 caracteres en claro. No se guarda en el cliente.
  final String pin;
  final String? usuarioEtiqueta;
  final List<Rol> roles;

  /// `true` si el usuario se acaba de crear; `false` si se regeneró el PIN
  /// (y el anterior dejó de funcionar).
  final bool esNuevo;

  /// El usuario creado (para asignarle puertas a continuación).
  final String? usuarioId;

  String get codigoDeCuenta => pin.substring(0, 3);
  String get clave => pin.substring(3);
}

/// Puertas a las que está asignado un usuario (típicamente un guardia): todas
/// o una lista. Sin asignación, un guardia no ve eventos de ninguna puerta.
@immutable
class PuertasAsignadas {
  const new({this.todas = false, this.puertaIds = const {}});

  final bool todas;
  final Set<String> puertaIds;
}

/// Los 4 caracteres finales del PIN que el administrador puede elegir (ADR
/// 0018, addendum): letras y números, sin distinguir mayúsculas.
final _formatoSufijoDePin = RegExp(r'^[A-Za-z0-9]{4}$');

bool sufijoDePinValido(String sufijo) => _formatoSufijoDePin.hasMatch(sufijo);

/// Qué está mal en el formulario de usuario.
enum ErrorDatosUsuario { sinEtiqueta, etiquetaLarga, sinRoles, sufijoInvalido }

/// Datos validados del formulario de usuario.
@immutable
class DatosUsuario {
  new({required String etiqueta, required Set<String> rolIds, this.sufijoDePin})
    : assert(
        errorDe(etiqueta: etiqueta, rolIds: rolIds) == null,
        'Los datos del usuario tienen que validarse antes',
      ),
      etiqueta = etiqueta.trim(),
      rolIds = rolIds.toList();

  /// Largo de `usuarios.etiqueta` en la API.
  static const largoMaximoEtiqueta = 80;

  final String etiqueta;
  final List<String> rolIds;

  /// Los 4 caracteres del PIN si el administrador los eligió; `null` = al azar.
  final String? sufijoDePin;

  static ErrorDatosUsuario? errorDe({
    required String etiqueta,
    required Set<String> rolIds,
  }) {
    if (etiqueta.trim().isEmpty) return ErrorDatosUsuario.sinEtiqueta;
    if (etiqueta.trim().length > largoMaximoEtiqueta) {
      return ErrorDatosUsuario.etiquetaLarga;
    }
    if (rolIds.isEmpty) return ErrorDatosUsuario.sinRoles;
    return null;
  }
}
