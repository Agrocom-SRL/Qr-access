/// Una respuesta de la API guardada en el dispositivo y cuándo se guardó.
class EntradaCache {
  const new({required this.cuerpo, required this.guardadoAt});

  /// El JSON de la respuesta, tal como llegó.
  final String cuerpo;
  final DateTime guardadoAt;
}

/// Guarda las últimas respuestas buenas de la API para seguir mostrando
/// puertas, eventos y QR cuando no hay internet (modo sin conexión).
///
/// Es una caché de **lectura**: nunca decide nada de seguridad. La puerta
/// sigue abriendo solo con la validación del servidor (invariante 2) y los
/// permisos siguen siendo los de la API (ADR 0004). En móvil vive en SQLite;
/// en web, solo en memoria.
abstract interface class AlmacenCache {
  Future<EntradaCache?> leer(String clave);

  Future<void> guardar(String clave, String cuerpo);

  /// Olvida todo: se llama al cerrar la sesión, para que otra persona que use
  /// el mismo teléfono no vea datos de otra cuenta (invariante 1).
  Future<void> borrarTodo();
}
