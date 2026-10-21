/// Códigos de permiso que la app consulta para mostrar menús y proteger rutas.
/// La API es la que decide; la app solo oculta lo que el rol activo no puede
/// usar (ADR 0004). Son los del catálogo de la API (`db/seeds/01_catalogo.sql`).
///
/// Los `*_todos` de la API amplían el alcance de un listado a toda la cuenta y
/// los aplica el servidor; la app los usa solo para elegir qué tablero mostrar.
abstract final class Permisos {
  static const verPuertas = 'organizacion.puerta.ver';

  /// Ver el estado de las puertas y sus lectores (pestaña Puertas).
  static const supervisarPuertas = 'organizacion.puerta.supervisar';

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
  static const verTodosLosEventos = 'accesos.evento.ver_todos';

  /// Los eventos de las puertas asignadas al guardia.
  static const verEventosAsignados = 'accesos.evento.ver_asignadas';

  /// Crear, editar y dar de baja los sitios y las puertas de la cuenta.
  static const administrarSitios = 'organizacion.sitio.administrar';
  static const administrarPuertas = 'organizacion.puerta.administrar';

  /// Asignar guardias a puertas.
  static const asignarGuardias = 'organizacion.guardia.asignar';

  static const verUsuarios = 'seguridad.usuario.ver';
  static const crearUsuarios = 'seguridad.usuario.crear';
  static const editarUsuarios = 'seguridad.usuario.editar';
  static const eliminarUsuarios = 'seguridad.usuario.eliminar';

  /// Ver cuánto del cupo de usuarios del plan usa la cuenta: solo el
  /// Administrador (ADR 0028 §6).
  static const verCupo = 'seguridad.cupo.ver';

  /// Ver el uso de los usuarios de la rama (inactivos, ruidosos, Titulares
  /// cerca del tope): solo el Administrador (ADR 0028 §4).
  static const verEstadisticas = 'seguridad.estadistica.ver';
}
