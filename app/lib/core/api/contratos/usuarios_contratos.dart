import 'package:agrocom_acceso/core/api/contratos/comunes.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';

/// Elemento de `GET /usuarios` (HU-06). Nunca trae nada del PIN.
class UsuarioAdminDto {
  const new({
    required this.id,
    required this.etiqueta,
    required this.activo,
    required this.roles,
    required this.pinGeneradoAt,
    required this.ultimoIngresoAt,
    required this.creadoAt,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      etiqueta = json['etiqueta'] as String?,
      activo = json['activo'] as bool,
      roles = [
        for (final rol in json['roles'] as List<dynamic>)
          RolDto.desde(rol as Map<String, dynamic>),
      ],
      pinGeneradoAt = fechaDeApiOpcional(json['pin_generado_at']),
      ultimoIngresoAt = fechaDeApiOpcional(json['ultimo_ingreso_at']),
      creadoAt = fechaDeApi(json['created_at'] as String);

  final String id;
  final String? etiqueta;
  final bool activo;
  final List<RolDto> roles;
  final DateTime? pinGeneradoAt;
  final DateTime? ultimoIngresoAt;
  final DateTime creadoAt;
}

/// Respuesta de `POST /usuarios` (201): el usuario y su PIN, una sola vez.
class UsuarioCreadoDto {
  new desde(Map<String, dynamic> json)
    : usuario = UsuarioAdminDto.desde(json),
      pin = json['pin'] as String;

  final UsuarioAdminDto usuario;
  final String pin;
}

/// Respuesta de `POST /usuarios/{id}/pin`.
class PinGeneradoDto {
  new desde(Map<String, dynamic> json)
    : pin = json['pin'] as String,
      pinGeneradoAt = fechaDeApi(json['pin_generado_at'] as String);

  final String pin;
  final DateTime pinGeneradoAt;
}
