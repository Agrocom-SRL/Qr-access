/// Rutas de la app. Sin imports: las páginas las usan sin depender del router.
abstract final class Rutas {
  /// Mientras se restaura la sesión guardada (móvil).
  static const arranque = '/arranque';
  static const ingreso = '/ingreso';
  static const elegirRol = '/roles';
  static const inicio = '/inicio';

  /// Listado de los QR emitidos por el usuario.
  static const qrMios = '/qr';

  /// Emitir un QR nuevo.
  static const qrNuevo = '/qr/nuevo';

  /// El QR recién emitido, con su token. Solo llega con `extra`: no tiene
  /// URL que se pueda volver a abrir.
  static const qrEmitido = '/qr/emitido';

  static const eventos = '/eventos';
}
