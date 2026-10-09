/// Códigos de permiso que la app consulta para mostrar menús y proteger rutas.
/// La API es la que decide; la app solo oculta lo que el rol activo no puede
/// usar (ADR 0004). Son los del catálogo de la API (`db/seeds/01_catalogo.sql`).
///
/// Los `*_todos` de la API no se consultan aquí: amplían el alcance de un
/// listado o una anulación a toda la cuenta y los aplica el servidor.
abstract final class Permisos {
  static const emitirQr = 'accesos.qr.emitir';

  /// Listar los QR emitidos: los propios, o todos los de la cuenta con
  /// `accesos.qr.ver_todos`.
  static const verQr = 'accesos.qr.ver';

  /// Anular un QR vigente: los propios, o cualquiera de la cuenta con
  /// `accesos.qr.anular_todos`.
  static const anularQr = 'accesos.qr.anular';

  /// Consultar los eventos de acceso: los de sus QR, o todos los de la cuenta
  /// con `accesos.evento.ver_todos`.
  static const verEventos = 'accesos.evento.ver';
}
