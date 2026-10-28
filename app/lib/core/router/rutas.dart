/// Rutas de la app. Sin imports: las páginas las usan sin depender del router.
abstract final class Rutas {
  /// Mientras se restaura la sesión guardada (móvil).
  static const arranque = '/arranque';
  static const bienvenida = '/bienvenida';
  static const ingreso = '/ingreso';
  static const inicio = '/inicio';

  /// Listado de los QR generados por el usuario.
  static const qrMios = '/qr';

  /// Generar un QR nuevo.
  static const qrNuevo = '/qr/nuevo';

  /// QR rápido: genera al instante el QR propio, sin formulario ni compartir.
  static const qrRapido = '/qr/rapido';

  /// El QR recién generado, con su token. Solo llega con `extra`: no tiene
  /// URL que se pueda volver a abrir.
  static const qrGenerado = '/qr/generado';

  /// Lecturas (antes "eventos"): la URL sigue el nombre que ve la persona.
  static const eventos = '/lecturas';

  /// La URL anterior de Lecturas: quien la tenga guardada llega a [eventos].
  static const eventosAnterior = '/eventos';
  static const perfil = '/perfil';

  /// Dispositivos conectados (ADR 0030 §4.1): desde Perfil. Sin permiso, es de
  /// quien la abre.
  static const dispositivos = '/dispositivos';

  /// Bandeja de notificaciones de la cuenta (ADR 0030 §6), desde el Inicio.
  static const notificaciones = '/notificaciones';

  /// Administración en compacto: Puertas y Usuarios en pestañas.
  static const admin = '/admin';
  static const adminPuertas = '/admin/puertas';

  /// Gestión de sitios y puertas de la cuenta (HU-07).
  static const adminEstructura = '/admin/estructura';
  static const adminUsuarios = '/admin/usuarios';
  static const adminUsuarioNuevo = '/admin/usuarios/nuevo';

  /// Uso de los usuarios de la rama (inactivos, ruidosos y Titulares).
  static const adminEstadisticas = '/admin/usuarios/estadisticas';

  /// Editar un usuario: `/admin/usuarios/:id`.
  static const adminUsuarioEditar = '/admin/usuarios/:id';

  /// El PIN recién generado. Solo llega con `extra` (ADR 0018 §3).
  static const adminPinGenerado = '/admin/usuarios/pin';

  static String adminUsuario(String id) => '/admin/usuarios/$id';

  /// Incidentes de uso de mi rama (ADR 0033 §4), desde Perfil.
  static const incidentes = '/incidentes';

  /// Un incidente con su historial: `/incidentes/:id`. Se abre también desde
  /// un aviso de propuesta de la bandeja.
  static const incidenteDetalle = '/incidentes/:id';

  /// Exportar en CSV los datos de mi rama, desde Perfil (solo el
  /// Administrador).
  static const exportar = '/exportar';

  /// Bajar los accesos a puertas en CSV, con sus filtros; desde Exportar.
  static const exportarAccesos = '/exportar/accesos';

  /// Anular los QR vigentes de mis usuarios, desde Perfil (pantalla completa).
  static const anularQrDeRama = '/qr/anular';

  static String incidente(String id) => '/incidentes/$id';
}
