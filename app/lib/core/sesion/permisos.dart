/// Códigos de permiso que la app consulta para mostrar menús y proteger rutas.
/// La API es la que decide; la app solo oculta lo que el rol activo no puede
/// usar (ADR 0004). Los códigos de la API se confirman con el backend;
/// los marcados como provisionales todavía no están confirmados.
abstract final class Permisos {
  static const emitirQr = 'accesos.qr.emitir';

  /// Listar los QR emitidos por el usuario. Provisional: confirmar con el
  /// backend.
  static const verQr = 'accesos.qr.ver';

  /// Anular un QR vigente. Provisional: confirmar con el backend.
  static const anularQr = 'accesos.qr.anular';

  /// Consultar los eventos de acceso de la cuenta. Provisional: confirmar con
  /// el backend.
  static const verEventos = 'accesos.eventos.ver';
}
