import 'package:agrocom_acceso/core/api/contratos/comunes.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';

/// Puerta de `GET /puertas/apertura-manual` (ADR 0035 §5), sin sentidos: la
/// app no sabe si la persona entra o sale.
class PuertaAbribleDto {
  const new({
    required this.id,
    required this.nombre,
    required this.sitio,
    required this.habilitada,
    required this.disponible,
    required this.tienePlaca,
    required this.enLinea,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String,
      sitio = ReferenciaDto.desde(json['sitio'] as Map<String, dynamic>),
      habilitada = json['habilitada'] as bool,
      disponible = json['disponible'] as bool,
      tienePlaca = json['tiene_placa'] as bool,
      enLinea = json['conexion'] == 'en_linea';

  final String id;
  final String nombre;
  final ReferenciaDto sitio;

  /// El administrador la encendió en esta puerta.
  final bool habilitada;

  /// Encendida y con al menos una placa en servicio: lo que ofrece el botón.
  final bool disponible;
  final bool tienePlaca;

  /// Alguna placa de la puerta reportó hace poco. Solo avisa: decide la API.
  final bool enLinea;
}

/// Lo que responde `POST /puertas/{id}/abrir` (202): la orden creada.
class OrdenCreadaDto {
  const new({
    required this.ordenId,
    required this.estado,
    required this.venceAt,
  });

  new desde(Map<String, dynamic> json)
    : ordenId = json['orden_id'] as String,
      estado = json['estado'] as String,
      venceAt = fechaDeApi(json['vence_at'] as String);

  final String ordenId;
  final String estado;
  final DateTime venceAt;
}

/// `GET /ordenes-apertura/{id}`: cómo va la orden y, si la placa ya informó,
/// qué pasó con la puerta.
class EstadoDeOrdenDto {
  const new({
    required this.ordenId,
    required this.estado,
    required this.resultado,
    required this.causa,
  });

  new desde(Map<String, dynamic> json)
    : ordenId = json['orden_id'] as String,
      estado = json['estado'] as String,
      resultado = _campo(json['resultado'], 'resultado'),
      causa = _campo(json['resultado'], 'causa');

  final String ordenId;

  /// `pendiente`, `entregada`, `ejecutada`, `fallida` o `vencida`.
  final String estado;

  /// `ejecutada`, `fallida` o `sin_confirmacion`; `null` mientras la placa no
  /// informó.
  final String? resultado;
  final String? causa;

  static String? _campo(Object? resultado, String nombre) =>
      resultado is Map<String, dynamic> ? resultado[nombre] as String? : null;
}
