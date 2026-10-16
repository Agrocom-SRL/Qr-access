/// Configuración que entra al compilar con `--dart-define`
/// (docs/gestion/entornos.md).
abstract final class Entorno {
  /// URL base de la API, sin `/api/v1`. En web servida por Nginx, vacía:
  /// la API está en el mismo origen.
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// Versión de la API en la ruta (ADR 0005).
  static const versionApi = 'v1';

  /// Espera máxima para conectar y para recibir una respuesta. Pasado el
  /// tiempo, la app muestra "sin conexión" en vez de quedarse cargando.
  static const tiempoEsperaSegundos = 15;
}
