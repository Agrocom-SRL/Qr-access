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

  /// Generar QR de visitas para compartirlos. El Guardia no lo tiene (ADR 0028
  /// §5): solo usa el suyo, con [generarQrPropio].
  static const generarQr = 'accesos.qr.generar';

  /// Generar el QR propio ("Mi QR de acceso"), para usarlo en este dispositivo.
  static const generarQrPropio = 'accesos.qr.generar_propio';

  /// Listar los QR generados: los propios, o todos los de la cuenta con
  /// `accesos.qr.ver_todos`.
  static const verQr = 'accesos.qr.ver';

  /// Anular un QR vigente: los propios, o cualquiera de la cuenta con
  /// `accesos.qr.anular_todos`.
  static const anularQr = 'accesos.qr.anular';

  /// Consultar las lecturas (intentos de lectura de un QR): las de sus QR, o
  /// todas las de la cuenta con `accesos.evento.ver_todos`.
  static const verEventos = 'accesos.evento.ver';
  static const verTodosLosEventos = 'accesos.evento.ver_todos';

  /// Los eventos de las puertas asignadas al guardia.
  static const verEventosAsignados = 'accesos.evento.ver_asignadas';

  /// Abrir una puerta desde la app, sin QR (ADR 0035): todos los roles de la
  /// cuenta. Y encender o apagar esa función por puerta: solo el
  /// Administrador de la cuenta.
  static const abrirPuertaManual = 'accesos.apertura_manual.usar';
  static const configurarAperturaManual = 'accesos.apertura_manual.configurar';

  /// Crear, editar y dar de baja los sitios y las puertas de la cuenta.
  static const administrarSitios = 'organizacion.sitio.administrar';
  static const administrarPuertas = 'organizacion.puerta.administrar';

  /// Asignar guardias a puertas.
  static const asignarGuardias = 'organizacion.guardia.asignar';

  /// Ver mi bandeja de notificaciones de la cuenta, y marcarlas leídas (ADR
  /// 0030 §6). Son permisos de la cuenta, nunca de plataforma.
  static const verNotificaciones = 'notificaciones.aviso.ver';
  static const gestionarNotificaciones = 'notificaciones.aviso.gestionar';

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

  /// Ver los incidentes de uso de mi rama (ADR 0033 §3): el Administrador, el
  /// Titular, el Miembro y el Guardia, cada uno sobre lo que le toca.
  static const verIncidentes = 'seguridad.incidente.ver';

  /// Confirmar, descartar o dejar pendiente un incidente de mi rama (ADR 0033
  /// §3): solo el Administrador y el Titular. Nunca uno propio.
  static const resolverIncidentes = 'seguridad.incidente.resolver';

  /// Anular en bloque los QR vigentes de mi rama (ADR 0033 §3). Cada nivel lo
  /// hace sobre lo que le toca: el Administrador, su rama entera.
  static const anularQrDeRama = 'accesos.qr.anular_masivo';

  /// Exportar en CSV los datos de mi rama (ADR 0033 §3): solo el Administrador.
  static const exportarDatos = 'accesos.evento.exportar';
}
