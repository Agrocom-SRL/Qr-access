import 'package:agrocom_acceso/core/api/contratos/comunes.dart';

/// Una sesión viva de mi usuario, de `GET /sesiones` (ADR 0030 §4.1). La IP no
/// se lee: no hace falta para que la persona reconozca sus aparatos.
class SesionAbiertaDto {
  const new({
    required this.id,
    required this.plataforma,
    required this.dispositivo,
    required this.iniciadaAt,
    required this.ultimaActividadAt,
    required this.expiraAt,
    required this.actual,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      plataforma = json['plataforma'] as String?,
      dispositivo = json['dispositivo'] as String?,
      iniciadaAt = fechaDeApi(json['iniciada_at'] as String),
      ultimaActividadAt = fechaDeApi(json['ultima_actividad_at'] as String),
      expiraAt = fechaDeApi(json['expira_at'] as String),
      actual = json['actual'] as bool;

  final String id;

  /// `android`, `ios` o `web`; `null` si la sesión no lo declaró.
  final String? plataforma;

  /// Nombre que mandó el cliente (texto libre acotado): se muestra como texto
  /// plano, nunca interpretado (ADR 0030 §4.1).
  final String? dispositivo;
  final DateTime iniciadaAt;
  final DateTime ultimaActividadAt;
  final DateTime expiraAt;

  /// `true` para la sesión desde la que se hace esta consulta.
  final bool actual;
}
