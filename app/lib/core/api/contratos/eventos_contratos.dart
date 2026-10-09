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
    required this.qrId,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      ocurridoAt = fechaDeApi(json['ocurrido_at'] as String),
      resultado = json['resultado'] as String,
      motivoCode = json['motivo_code'] as String,
      puerta = ReferenciaDto.desde(json['puerta'] as Map<String, dynamic>),
      qrId = json['qr_id'] as String?;

  final String id;
  final DateTime ocurridoAt;

  /// `permitido` o `rechazado`.
  final String resultado;

  /// Código del motivo (`acceso.permitido`, `qr.vencido`…): la app lo traduce.
  final String motivoCode;
  final ReferenciaDto puerta;
  final String? qrId;
}
