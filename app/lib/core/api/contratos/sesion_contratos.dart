import 'package:agrocom_acceso/core/api/contratos/comunes.dart';

/// Respuesta de `POST /sesiones` (contrato común V1, ADR 0018).
class RespuestaInicioDto {
  const new({
    required this.acceso,
    required this.refresco,
    required this.usuario,
    required this.cuenta,
    required this.roles,
    required this.rolActivoId,
  });

  new desde(Map<String, dynamic> json)
    : acceso = json['acceso'] as String,
      refresco = json['refresco'] as String,
      usuario = UsuarioDto.desde(json['usuario'] as Map<String, dynamic>),
      cuenta = CuentaDto.desde(json['cuenta'] as Map<String, dynamic>),
      roles = [
        for (final rol in json['roles'] as List<dynamic>)
          RolDto.desde(rol as Map<String, dynamic>),
      ],
      rolActivoId = json['rol_activo_id'] as String?;

  final String acceso;
  final String refresco;
  final UsuarioDto usuario;
  final CuentaDto cuenta;
  final List<RolDto> roles;

  /// `null` cuando el usuario tiene varios roles y todavía no eligió uno.
  final String? rolActivoId;
}

/// Respuesta de `POST /sesiones/refresco`: el refresco es rotativo.
class TokensDto {
  const new({required this.acceso, required this.refresco});

  new desde(Map<String, dynamic> json)
    : acceso = json['acceso'] as String,
      refresco = json['refresco'] as String;

  final String acceso;
  final String refresco;
}

/// Respuesta de `GET /sesiones/actual`: menú, permisos y suscripción.
class SesionActualDto {
  const new({
    required this.usuario,
    required this.cuenta,
    required this.roles,
    required this.rolActivo,
    required this.permisos,
    required this.suscripcion,
  });

  new desde(Map<String, dynamic> json)
    : usuario = UsuarioDto.desde(json['usuario'] as Map<String, dynamic>),
      cuenta = CuentaDto.desde(json['cuenta'] as Map<String, dynamic>),
      roles = [
        for (final rol in json['roles'] as List<dynamic>)
          RolDto.desde(rol as Map<String, dynamic>),
      ],
      rolActivo = json['rol_activo'] == null
          ? null
          : RolDto.desde(json['rol_activo'] as Map<String, dynamic>),
      permisos = [
        for (final p in json['permisos'] as List<dynamic>) p as String,
      ],
      suscripcion = json['suscripcion'] == null
          ? null
          : SuscripcionDto.desde(json['suscripcion'] as Map<String, dynamic>);

  final UsuarioDto usuario;
  final CuentaDto cuenta;

  /// Todos los roles del usuario, para elegir uno al reabrir sin rol activo.
  final List<RolDto> roles;
  final RolDto? rolActivo;
  final List<String> permisos;

  /// `null` sin suscripción vigente (la app lo avisa; la API no emite QR).
  final SuscripcionDto? suscripcion;
}

class UsuarioDto {
  const new({required this.id, required this.etiqueta});

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      etiqueta = json['etiqueta'] as String?;

  final String id;

  /// `null` cuando a quien se le entregó el PIN no tiene etiqueta.
  final String? etiqueta;
}

class CuentaDto {
  const new({required this.id, required this.codigo, required this.nombre});

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      codigo = json['codigo'] as String,
      nombre = json['nombre'] as String;

  final String id;
  final String codigo;
  final String nombre;
}

class RolDto {
  const new({required this.id, required this.nombre});

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String;

  final String id;
  final String nombre;
}

class SuscripcionDto {
  const new({required this.plan, required this.hasta});

  new desde(Map<String, dynamic> json)
    : plan = json['plan'] as String,
      hasta = fechaDeApi(json['hasta'] as String);

  final String plan;
  final DateTime hasta;
}
