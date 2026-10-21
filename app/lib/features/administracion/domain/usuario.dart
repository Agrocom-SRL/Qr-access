import 'package:agrocom_acceso/features/administracion/domain/nivel_usuario.dart';
import 'package:flutter/foundation.dart';

/// Un rol de la cuenta, para asignarlo (HU-06).
@immutable
class Rol {
  const new({required this.id, required this.nombre});

  final String id;
  final String nombre;
}

/// La unidad de un Titular (casa, departamento, pabellón…) dentro de una
/// propiedad (ADR 0028).
@immutable
class UnidadUsuario {
  const new({required this.id, required this.nombre, required this.sitioId});

  final String id;
  final String nombre;
  final String sitioId;
}

/// Un usuario (PIN) de la cuenta, como lo administra quien lo creó. Nunca
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
    this.unidad,
  });

  final String id;
  final String? etiqueta;
  final bool activo;
  final List<Rol> roles;

  /// Solo un Titular tiene unidad.
  final UnidadUsuario? unidad;
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

  /// El usuario del PIN: al crearlo, para asignarle puertas a continuación; en
  /// ambos casos, para registrar que se compartió.
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
enum ErrorDatosUsuario {
  sinEtiqueta,
  etiquetaLarga,
  sinRol,
  sufijoInvalido,
  sinPropiedad,
  sinNombreDeUnidad,
  nombreDeUnidadLargo,
}

/// La unidad que acompaña a un Titular nuevo: en qué propiedad está y cómo se
/// llama.
@immutable
class DatosUnidad {
  const new({required this.sitioId, required this.nombre});

  /// Largo de `unidades.nombre` en la API.
  static const largoMaximoNombre = 80;

  final String sitioId;
  final String nombre;
}

/// Datos validados del formulario de alta de un usuario. Un usuario tiene un
/// solo rol (ADR 0028) y un Titular lleva además su unidad.
@immutable
class DatosUsuario {
  new({
    required String etiqueta,
    required this.rolId,
    this.unidad,
    this.sufijoDePin,
  }) : assert(
         errorDe(etiqueta: etiqueta, rolId: rolId, nivel: null) == null,
         'Los datos del usuario tienen que validarse antes',
       ),
       etiqueta = etiqueta.trim();

  /// Largo de `usuarios.etiqueta` en la API.
  static const largoMaximoEtiqueta = 80;

  final String etiqueta;
  final String rolId;

  /// Solo para un Titular; `null` en los demás niveles.
  final DatosUnidad? unidad;

  /// Los 4 caracteres del PIN si quien lo crea los eligió; `null` = al azar.
  final String? sufijoDePin;

  /// Solo el nombre: es lo único que se edita de un usuario ya creado.
  static ErrorDatosUsuario? errorDeEtiqueta(String etiqueta) {
    if (etiqueta.trim().isEmpty) return ErrorDatosUsuario.sinEtiqueta;
    if (etiqueta.trim().length > largoMaximoEtiqueta) {
      return ErrorDatosUsuario.etiquetaLarga;
    }
    return null;
  }

  /// El primer error de los datos de un alta. `nivel` es el del rol elegido:
  /// solo un Titular exige propiedad y nombre de unidad.
  static ErrorDatosUsuario? errorDe({
    required String etiqueta,
    required String? rolId,
    required NivelUsuario? nivel,
    String? sitioId,
    String unidad = '',
  }) {
    final deEtiqueta = errorDeEtiqueta(etiqueta);
    if (deEtiqueta != null) return deEtiqueta;
    if (rolId == null) return ErrorDatosUsuario.sinRol;
    if (nivel == NivelUsuario.titular) {
      if (sitioId == null) return ErrorDatosUsuario.sinPropiedad;
      if (unidad.trim().isEmpty) return ErrorDatosUsuario.sinNombreDeUnidad;
      if (unidad.trim().length > DatosUnidad.largoMaximoNombre) {
        return ErrorDatosUsuario.nombreDeUnidadLargo;
      }
    }
    return null;
  }
}
