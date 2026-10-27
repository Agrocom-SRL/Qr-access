import 'package:flutter/foundation.dart';

/// Lo que la app sabe de la última sincronización de un listado: cuándo llegó
/// una respuesta viva de la API, si ahora mismo se está pidiendo y si no hay
/// conexión (en cuyo caso se muestra lo último guardado, handoff §Estados).
///
/// Es inmutable y lo publica `ControladorSincronizacion`; la pantalla solo lo
/// pinta (`LineaSincronizacion`).
@immutable
class EstadoSincronizacion {
  const new({
    this.ultimaActualizacion,
    this.actualizando = false,
    this.sinConexion = false,
  });

  /// Instante (hora del reloj inyectado) de la última respuesta viva. `null`
  /// si todavía no hubo ninguna.
  final DateTime? ultimaActualizacion;

  /// Hay una petición en curso: no se lanza otra mientras tanto.
  final bool actualizando;

  /// La última petición no llegó y se muestra lo guardado en el dispositivo.
  final bool sinConexion;

  EstadoSincronizacion copiar({
    DateTime? ultimaActualizacion,
    bool? actualizando,
    bool? sinConexion,
  }) => EstadoSincronizacion(
    ultimaActualizacion: ultimaActualizacion ?? this.ultimaActualizacion,
    actualizando: actualizando ?? this.actualizando,
    sinConexion: sinConexion ?? this.sinConexion,
  );

  @override
  bool operator ==(Object other) =>
      other is EstadoSincronizacion &&
      other.ultimaActualizacion == ultimaActualizacion &&
      other.actualizando == actualizando &&
      other.sinConexion == sinConexion;

  @override
  int get hashCode =>
      Object.hash(ultimaActualizacion, actualizando, sinConexion);
}
