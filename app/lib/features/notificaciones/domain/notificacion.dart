import 'package:flutter/foundation.dart';

/// Qué tan urgente es un aviso (ADR 0030 §6): lo que la API manda como
/// `info`, `aviso` o `critica`.
enum Severidad {
  info,
  aviso,
  critica;

  /// Un valor que no se conoce cae en `info`: el aviso se muestra igual, sin
  /// subir su urgencia por error.
  static Severidad desdeApi(String valor) => switch (valor) {
    'aviso' => Severidad.aviso,
    'critica' => Severidad.critica,
    _ => Severidad.info,
  };
}

/// Los tipos de aviso que la app sabe nombrar (ADR 0030 §5 y §6, ADR 0031
/// §18). Un tipo que no está aquí se muestra con un texto genérico.
enum TipoNotificacion {
  placaCaidaSostenida,
  placaDesaparecida,
  placaLectorSinRespuesta,
  placaRecuperada,
  aperturaFallida,
  propuestaIncidente,
  senalUsoMasivo,
  senalUsoImposible,
  senalQrReenviado,
  senalPinCompartido,
  bolsaAviso,
  bolsaSuperada,
  flujoAtipico,
  desconocido;

  /// Del tipo que llega de la API. Las señales (`senal.uso`) se distinguen por
  /// su subtipo (`datos.senal.tipo`), que llega aparte.
  static TipoNotificacion desdeApi(String tipo, {String? subtipo}) =>
      switch (tipo) {
        'placa.caida_sostenida' => placaCaidaSostenida,
        'placa.desaparecida' => placaDesaparecida,
        'placa.lector_sin_respuesta' => placaLectorSinRespuesta,
        'placa.recuperada' => placaRecuperada,
        'apertura.fallida' => aperturaFallida,
        'incidente.propuesta' => propuestaIncidente,
        'senal.uso' => _senalDesdeApi(subtipo),
        'bolsa.aviso' => bolsaAviso,
        'bolsa.superada' => bolsaSuperada,
        'flujo.atipico' => flujoAtipico,
        _ => desconocido,
      };

  static TipoNotificacion _senalDesdeApi(String? subtipo) => switch (subtipo) {
    'uso_masivo' => senalUsoMasivo,
    'uso_imposible' => senalUsoImposible,
    'qr_reenviado' => senalQrReenviado,
    'pin_compartido' => senalPinCompartido,
    _ => desconocido,
  };
}

/// Un aviso de mi bandeja (ADR 0030 §6). Solo lleva lo que la pantalla
/// muestra: nada de ids internos ni cifras de detección.
@immutable
class Notificacion {
  const new({
    required this.id,
    required this.tipo,
    required this.severidad,
    required this.cantidad,
    required this.leida,
    required this.puertas,
    required this.sitio,
    required this.usuario,
    required this.novedadAt,
  });

  final String id;
  final TipoNotificacion tipo;
  final Severidad severidad;

  /// Cuántas placas hay en el aviso agrupado.
  final int cantidad;
  final bool leida;

  /// Nombres de las puertas del aviso, como texto plano.
  final List<String> puertas;

  /// Sitio, si el aviso habla de uno.
  final String? sitio;

  /// Etiqueta del usuario, si el aviso habla de uno. Texto plano.
  final String? usuario;

  /// Cuándo pasó lo que avisa (UTC).
  final DateTime novedadAt;

  /// Solo se marca leída si aún no lo está.
  bool get puedeMarcarLeida => !leida;
}
