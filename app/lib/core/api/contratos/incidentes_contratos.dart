import 'package:agrocom_acceso/core/api/contratos/comunes.dart';

/// Una persona de un incidente o de una resolución (`id` y `etiqueta`). La
/// etiqueta puede faltar y es texto libre: se muestra como texto plano.
class PersonaDto {
  const new({required this.id, required this.etiqueta});

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      etiqueta = json['etiqueta'] as String?;

  final String id;
  final String? etiqueta;
}

/// Cuántos ids de evidencia hay de cada clase. La app no pinta los ids: solo
/// cuántos, nunca un token ni un hash (la API ya los omite).
class EvidenciaDto {
  const new({
    required this.cuantosQr,
    required this.cuantosAccesos,
    required this.cuantosLimites,
  });

  new desde(Map<String, dynamic> json)
    : cuantosQr = (json['qr_ids'] as List<dynamic>).length,
      cuantosAccesos = (json['evento_acceso_ids'] as List<dynamic>).length,
      cuantosLimites = (json['evento_limite_ids'] as List<dynamic>).length;

  final int cuantosQr;
  final int cuantosAccesos;
  final int cuantosLimites;
}

/// Una resolución del historial: qué se decidió, con qué motivo y quién.
class ResolucionDto {
  const new({
    required this.resultado,
    required this.motivo,
    required this.resueltoPor,
    required this.resueltaAt,
  });

  new desde(Map<String, dynamic> json)
    : resultado = json['resultado'] as String,
      motivo = json['motivo'] as String?,
      resueltoPor = PersonaDto.desde(
        json['resuelto_por'] as Map<String, dynamic>,
      ),
      resueltaAt = fechaDeApi(json['resuelta_at'] as String);

  final String resultado;
  final String? motivo;
  final PersonaDto resueltoPor;
  final DateTime resueltaAt;
}

/// Un incidente de uso (`GET /incidentes`, `GET /incidentes/{id}`). Solo el
/// detalle trae `historial`; en el listado llega vacío.
class IncidenteDto {
  const new({
    required this.id,
    required this.usuario,
    required this.tipo,
    required this.gravedad,
    required this.origen,
    required this.registradoPor,
    required this.descripcion,
    required this.evidencia,
    required this.estado,
    required this.resolucion,
    required this.ocurridoAt,
    required this.creadoAt,
    required this.historial,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      usuario = PersonaDto.desde(json['usuario'] as Map<String, dynamic>),
      tipo = json['tipo'] as String,
      gravedad = json['gravedad'] as String,
      origen = json['origen'] as String,
      registradoPor = _personaOpcional(json['registrado_por']),
      descripcion = json['descripcion'] as String?,
      evidencia = EvidenciaDto.desde(json['evidencia'] as Map<String, dynamic>),
      estado = json['estado'] as String,
      resolucion = _resolucionOpcional(json['resolucion']),
      ocurridoAt = fechaDeApi(json['ocurrido_at'] as String),
      creadoAt = fechaDeApi(json['created_at'] as String),
      historial = [
        for (final resolucion
            in (json['historial'] as List<dynamic>?) ?? const <dynamic>[])
          ResolucionDto.desde(resolucion as Map<String, dynamic>),
      ];

  final String id;
  final PersonaDto usuario;
  final String tipo;
  final String gravedad;
  final String origen;
  final PersonaDto? registradoPor;

  /// Texto libre de quien lo registró a mano; se muestra tal cual.
  final String? descripcion;
  final EvidenciaDto evidencia;

  /// `sin_resolver` o el resultado de la última resolución.
  final String estado;
  final ResolucionDto? resolucion;
  final DateTime ocurridoAt;
  final DateTime creadoAt;
  final List<ResolucionDto> historial;
}

/// La política de reincidencia que aplica a la cuenta (`GET /incidentes/politica`).
class PoliticaDto {
  const new({
    required this.reincidenciaMinimo,
    required this.reincidenciaVentanaDias,
    required this.restriccionAutomatica,
  });

  new desde(Map<String, dynamic> json)
    : reincidenciaMinimo = (json['reincidencia_minimo'] as num).toInt(),
      reincidenciaVentanaDias = (json['reincidencia_ventana_dias'] as num)
          .toInt(),
      restriccionAutomatica = json['restriccion_automatica'] as bool;

  final int reincidenciaMinimo;
  final int reincidenciaVentanaDias;
  final bool restriccionAutomatica;
}

/// Las cifras de la reincidencia que devuelve una resolución confirmada.
class ReincidenciaDto {
  const new({
    required this.confirmados,
    required this.minimo,
    required this.ventanaDias,
    required this.propuesta,
    required this.aplicadaAutomaticamente,
  });

  new desde(Map<String, dynamic> json)
    : confirmados = (json['confirmados'] as num).toInt(),
      minimo = (json['minimo'] as num).toInt(),
      ventanaDias = (json['ventana_dias'] as num).toInt(),
      propuesta = json['propuesta'] as String?,
      aplicadaAutomaticamente = json['aplicada_automaticamente'] as bool;

  final int confirmados;
  final int minimo;
  final int ventanaDias;

  /// `restringir`, `suspender`, `suspender_y_anular`, o `null` si no
  /// corresponde.
  final String? propuesta;
  final bool aplicadaAutomaticamente;
}

/// Respuesta de `POST /incidentes/{id}/resolucion`.
class RespuestaResolucionDto {
  const new({required this.incidente, required this.reincidencia});

  new desde(Map<String, dynamic> json)
    : incidente = IncidenteDto.desde(json['incidente'] as Map<String, dynamic>),
      reincidencia = json['reincidencia'] == null
          ? null
          : ReincidenciaDto.desde(json['reincidencia'] as Map<String, dynamic>);

  final IncidenteDto incidente;

  /// Solo al confirmar; `null` en los demás resultados.
  final ReincidenciaDto? reincidencia;
}

PersonaDto? _personaOpcional(Object? json) =>
    json == null ? null : PersonaDto.desde(json as Map<String, dynamic>);

ResolucionDto? _resolucionOpcional(Object? json) =>
    json == null ? null : ResolucionDto.desde(json as Map<String, dynamic>);
