import 'package:agrocom_acceso/core/api/contratos/comunes.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';

/// Elemento de `GET /eventos-acceso` (contrato común V1, ADR 0007).
class EventoAccesoDto {
  const new({
    required this.id,
    required this.ocurridoAt,
    required this.resultado,
    required this.motivoCode,
    required this.puerta,
    required this.sitio,
    required this.qr,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      ocurridoAt = fechaDeApi(json['ocurrido_at'] as String),
      resultado = json['resultado'] as String,
      motivoCode = json['motivo_code'] as String,
      puerta = ReferenciaDto.desde(json['puerta'] as Map<String, dynamic>),
      sitio = ReferenciaDto.desde(
        (json['puerta'] as Map<String, dynamic>)['sitio']
            as Map<String, dynamic>,
      ),
      qr = json['qr'] == null
          ? null
          : QrDeEventoDto.desde(json['qr'] as Map<String, dynamic>);

  final String id;
  final DateTime ocurridoAt;

  /// `permitido` o `rechazado`.
  final String resultado;

  /// Código del motivo (`acceso.permitido`, `qr.vencido`…): la app lo traduce.
  final String motivoCode;
  final ReferenciaDto puerta;
  final ReferenciaDto sitio;

  /// El QR leído y quién lo emitió; `null` si no era un QR de la cuenta.
  final QrDeEventoDto? qr;
}

class QrDeEventoDto {
  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      etiqueta = json['etiqueta'] as String?,
      emisorEtiqueta =
          (json['emisor'] as Map<String, dynamic>)['etiqueta'] as String?;

  final String id;
  final String? etiqueta;
  final String? emisorEtiqueta;
}

/// Respuesta de `GET /eventos-acceso/resumen`: indicadores del tablero.
class ResumenEventosDto {
  new desde(Map<String, dynamic> json)
    : permitidos = json['permitidos'] as int,
      rechazados = json['rechazados'] as int,
      rechazadosPorMotivo = {
        for (final fila in json['rechazados_por_motivo'] as List<dynamic>)
          (fila as Map<String, dynamic>)['motivo_code'] as String:
              fila['total'] as int,
      };

  final int permitidos;
  final int rechazados;
  final Map<String, int> rechazadosPorMotivo;
}
