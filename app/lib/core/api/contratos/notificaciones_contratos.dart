import 'package:agrocom_acceso/core/api/contratos/comunes.dart';

/// Una notificación de mi bandeja (`GET /notificaciones`, ADR 0030 §6). Del
/// contenido (`datos`) solo se leen los nombres que la pantalla muestra; el
/// resto (ids de incidente, cifras) no se pinta.
class NotificacionDto {
  const new({
    required this.id,
    required this.tipo,
    required this.severidad,
    required this.cantidad,
    required this.resuelta,
    required this.leida,
    required this.puertas,
    required this.sitio,
    required this.usuarioEtiqueta,
    required this.senalTipo,
    required this.novedadAt,
    required this.creadaAt,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      tipo = json['tipo'] as String,
      severidad = json['severidad'] as String,
      cantidad = (json['cantidad'] as num).toInt(),
      resuelta = json['resuelta'] as bool,
      leida = json['leida'] as bool,
      puertas = _puertasDe(json['datos'] as Map<String, dynamic>),
      sitio = _sitioDe(json['datos'] as Map<String, dynamic>),
      usuarioEtiqueta = _usuarioDe(json['datos'] as Map<String, dynamic>),
      senalTipo = _senalDe(json['datos'] as Map<String, dynamic>),
      novedadAt = fechaDeApi(json['novedad_at'] as String),
      creadaAt = fechaDeApi(json['creada_at'] as String);

  final String id;

  /// El tipo tal como llega (`placa.caida_sostenida`, `senal.uso`...). Un tipo
  /// nuevo que la app no conoce se muestra con un texto genérico.
  final String tipo;

  /// `info`, `aviso` o `critica`.
  final String severidad;

  /// Cuántas placas hay hoy en el aviso agrupado.
  final int cantidad;

  /// El incidente ya se resolvió (las placas volvieron).
  final bool resuelta;
  final bool leida;

  /// Nombres de las puertas del aviso, como texto plano.
  final List<String> puertas;

  /// Nombre del sitio, si el aviso habla de uno.
  final String? sitio;

  /// Etiqueta del usuario, si el aviso habla de uno (señales y propuestas).
  final String? usuarioEtiqueta;

  /// El subtipo de una señal de uso (`uso_masivo`, `pin_compartido`...); `null`
  /// en los demás avisos.
  final String? senalTipo;
  final DateTime novedadAt;
  final DateTime creadaAt;
}

List<String> _puertasDe(Map<String, dynamic> datos) {
  final placas = datos['placas'] as List<dynamic>? ?? const [];
  return [
    for (final placa in placas)
      (placa as Map<String, dynamic>)['puerta_nombre'] as String,
  ];
}

String? _sitioDe(Map<String, dynamic> datos) {
  final sitio = datos['sitio'] as Map<String, dynamic>?;
  return sitio?['nombre'] as String?;
}

String? _senalDe(Map<String, dynamic> datos) {
  final senal = datos['senal'] as Map<String, dynamic>?;
  return senal?['tipo'] as String?;
}

String? _usuarioDe(Map<String, dynamic> datos) {
  final propuesta = datos['propuesta'] as Map<String, dynamic>?;
  final senal = datos['senal'] as Map<String, dynamic>?;
  return (propuesta?['usuario_etiqueta'] ?? senal?['usuario_etiqueta'])
      as String?;
}
