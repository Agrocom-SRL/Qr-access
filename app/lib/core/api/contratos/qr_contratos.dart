import 'package:agrocom_acceso/core/api/contratos/comunes.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';

/// Respuesta de `POST /qr-accesos` (201). `texto` solo llega aquí: la app
/// no lo persiste (ADR 0008).
class QrEmitidoDto {
  const new({
    required this.id,
    required this.texto,
    required this.venceAt,
    required this.etiqueta,
    required this.puertas,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      texto = json['texto'] as String,
      venceAt = fechaDeApi(json['vence_at'] as String),
      etiqueta = json['etiqueta'] as String?,
      puertas = [
        for (final p in json['puertas'] as List<dynamic>)
          ReferenciaDto.desde(p as Map<String, dynamic>),
      ];

  final String id;
  final String texto;
  final DateTime venceAt;
  final String? etiqueta;
  final List<ReferenciaDto> puertas;
}

/// Elemento de `GET /qr-accesos`. El `estado` llega como texto del contrato.
class QrAccesoDto {
  const new({
    required this.id,
    required this.etiqueta,
    required this.estado,
    required this.venceAt,
    required this.usadoAt,
    required this.anuladoAt,
    required this.creadoAt,
    required this.puertas,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      etiqueta = json['etiqueta'] as String?,
      estado = json['estado'] as String,
      venceAt = fechaDeApi(json['vence_at'] as String),
      usadoAt = fechaDeApiOpcional(json['usado_at']),
      anuladoAt = fechaDeApiOpcional(json['anulado_at']),
      creadoAt = fechaDeApi(json['created_at'] as String),
      puertas = [
        for (final p in json['puertas'] as List<dynamic>)
          ReferenciaDto.desde(p as Map<String, dynamic>),
      ];

  final String id;
  final String? etiqueta;
  final String estado;
  final DateTime venceAt;
  final DateTime? usadoAt;
  final DateTime? anuladoAt;
  final DateTime creadoAt;
  final List<ReferenciaDto> puertas;
}

/// Respuesta de `GET /qr-accesos/resumen`: cuántos hay en cada estado.
class ResumenQrDto {
  new desde(Map<String, dynamic> json)
    : vigentes = json['vigentes'] as int,
      usados = json['usados'] as int,
      vencidos = json['vencidos'] as int,
      anulados = json['anulados'] as int;

  final int vigentes;
  final int usados;
  final int vencidos;
  final int anulados;
}
