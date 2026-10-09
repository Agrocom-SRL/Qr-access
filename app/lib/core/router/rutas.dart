/// Rutas de la app. Sin imports: las páginas las usan sin depender del router.
abstract final class Rutas {
  /// Mientras se restaura la sesión guardada (móvil).
  static const arranque = '/arranque';
  static const bienvenida = '/bienvenida';
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
  static const perfil = '/perfil';

  /// Administración en compacto: Puertas y Usuarios en pestañas.
  static const admin = '/admin';
  static const adminPuertas = '/admin/puertas';
  static const adminUsuarios = '/admin/usuarios';
  static const adminUsuarioNuevo = '/admin/usuarios/nuevo';

  /// Editar un usuario: `/admin/usuarios/:id`.
  static const adminUsuarioEditar = '/admin/usuarios/:id';

  /// El PIN recién generado. Solo llega con `extra` (ADR 0018 §3).
  static const adminPinGenerado = '/admin/usuarios/pin';

  static String adminUsuario(String id) => '/admin/usuarios/$id';
}
