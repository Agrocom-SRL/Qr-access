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

/// Un usuario con su uso de QR dentro de `GET /usuarios/estadisticas`.
class UsoDeUsuarioDto {
  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      etiqueta = json['etiqueta'] as String?,
      rol = json['rol'] as String?,
      unidad = json['unidad'] as String?,
      qrGenerados = (json['qr_generados'] as num).toInt(),
      qrUsados = (json['qr_usados'] as num).toInt(),
      maxQrEnUnDia = (json['max_qr_en_un_dia'] as num).toInt(),
      ultimoQrAt = fechaDeApiOpcional(json['ultimo_qr_at']),
      inactivo = json['inactivo'] as bool,
      ruidoso = json['ruidoso'] as bool;

  final String id;
  final String? etiqueta;
  final String? rol;
  final String? unidad;
  final int qrGenerados;
  final int qrUsados;
  final int maxQrEnUnDia;
  final DateTime? ultimoQrAt;
  final bool inactivo;
  final bool ruidoso;
}

class TitularConMiembrosDto {
  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      etiqueta = json['etiqueta'] as String?,
      unidad = json['unidad'] as String?,
      miembros = (json['miembros'] as num).toInt(),
      tope = (json['tope'] as num).toInt(),
      porcentaje = (json['porcentaje'] as num).toInt(),
      cercaDelTope = json['cerca_del_tope'] as bool;

  final String id;
  final String? etiqueta;
  final String? unidad;
  final int miembros;
  final int tope;
  final int porcentaje;
  final bool cercaDelTope;
}

/// Respuesta de `GET /usuarios/estadisticas` (ADR 0028 §4).
class EstadisticasDeUsuariosDto {
  new desde(Map<String, dynamic> json)
    : ventanaDias = (json['ventana_dias'] as num).toInt(),
      umbralInactivoDias = (json['umbral_inactivo_dias'] as num).toInt(),
      umbralRuidosoPorDia = (json['umbral_ruidoso_por_dia'] as num).toInt(),
      usuarios = [
        for (final u in json['usuarios'] as List<dynamic>)
          UsoDeUsuarioDto.desde(u as Map<String, dynamic>),
      ],
      titulares = [
        for (final t in json['titulares'] as List<dynamic>)
          TitularConMiembrosDto.desde(t as Map<String, dynamic>),
      ];

  final int ventanaDias;
  final int umbralInactivoDias;
  final int umbralRuidosoPorDia;
  final List<UsoDeUsuarioDto> usuarios;
  final List<TitularConMiembrosDto> titulares;
}
