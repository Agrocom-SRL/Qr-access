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
    this.unidad,
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
      unidad = json['unidad'] == null
          ? null
          : UnidadDto.desde(json['unidad'] as Map<String, dynamic>),
      creadoAt = fechaDeApi(json['created_at'] as String);

  final String id;
  final String? etiqueta;
  final bool activo;
  final List<RolDto> roles;

  /// La unidad de un Titular; `null` en el resto.
  final UnidadDto? unidad;
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

/// La unidad de un Titular dentro de `GET /usuarios` (ADR 0028).
class UnidadDto {
  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String,
      sitioId = json['sitio_id'] as String;

  final String id;
  final String nombre;
  final String sitioId;
}

/// Respuesta de `GET /cupo` (ADR 0028 §6).
class CupoDto {
  new desde(Map<String, dynamic> json)
    : usados = (json['usados'] as num).toInt(),
      maximo = (json['maximo'] as num?)?.toInt(),
      porcentaje = (json['porcentaje'] as num?)?.toInt(),
      aviso = json['aviso'] as String?,
      maxMiembrosPorTitular = (json['max_miembros_por_titular'] as num).toInt();

  final int usados;
  final int? maximo;
  final int? porcentaje;

  /// `cerca_del_limite`, `limite_alcanzado` o `null`.
  final String? aviso;
  final int maxMiembrosPorTitular;
}
