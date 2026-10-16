import 'package:agrocom_acceso/core/api/contratos/comunes.dart';

/// Puerta de un listado de `GET /puertas` (contrato común V1), con el estado
/// de su lector (HU-09).
class PuertaDto {
  const new({
    required this.id,
    required this.nombre,
    required this.sitio,
    required this.dispositivo,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String,
      sitio = ReferenciaDto.desde(json['sitio'] as Map<String, dynamic>),
      dispositivo = json['dispositivo'] == null
          ? null
          : DispositivoDto.desde(json['dispositivo'] as Map<String, dynamic>);

  final String id;
  final String nombre;
  final ReferenciaDto sitio;

  /// `null` cuando la puerta todavía no tiene lector.
  final DispositivoDto? dispositivo;
}

class DispositivoDto {
  const new({
    required this.id,
    required this.nombre,
    required this.enLinea,
    required this.ultimoLatidoAt,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String,
      enLinea = json['en_linea'] as bool,
      ultimoLatidoAt = fechaDeApiOpcional(json['ultimo_latido_at']);

  final String id;
  final String nombre;
  final bool enLinea;
  final DateTime? ultimoLatidoAt;
}

/// Referencia corta `{id, nombre}` a otro recurso (puerta, sitio).
class ReferenciaDto {
  const new({required this.id, required this.nombre});

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String;

  final String id;
  final String nombre;
}
