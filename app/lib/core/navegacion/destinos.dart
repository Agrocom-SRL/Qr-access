import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';

/// Destinos de la navegación principal (handoff §Breakpoints y navegación).
enum DestinoNav {
  inicio(Rutas.inicio),
  generarQr(Rutas.qrNuevo),
  misQr(Rutas.qrMios),
  eventos(Rutas.eventos),
  puertas(Rutas.adminPuertas),
  usuarios(Rutas.adminUsuarios),

  /// Pestaña "Admin" del compacto: Puertas y Usuarios en una sola pantalla.
  admin(Rutas.admin),
  perfil(Rutas.perfil);

  new(this.ruta);

  final String ruta;
}

/// Máximo de destinos en la `NavigationBar` del compacto.
const maxDestinosCompactos = 4;

/// Qué destinos ve el rol activo, según sus permisos y el ancho:
///
/// | Rol | Compacto | Rail |
/// |---|---|---|
/// | Usuario | Inicio · Mis QR · Eventos · Perfil | + Generar QR |
/// | Guardia | Inicio · Eventos · Puertas · Perfil | igual |
/// | Administrador | Inicio · Mis QR · Admin · Perfil | Inicio · Generar QR ·
///   Eventos · Puertas · Usuarios · Perfil |
///
/// En compacto caben cuatro: si sobran, Eventos cede el lugar (los ve desde
/// el tablero) antes que Mis QR o Admin, que son de uso diario.
///
/// No se mira el nombre del rol sino lo que puede hacer (ADR 0004): un rol a
/// medida cae en la combinación que le corresponda.
List<DestinoNav> destinosPara(SesionEstado sesion, ClasePantalla clase) {
  final administra = sesion.tiene(Permisos.verUsuarios);
  final supervisa = sesion.tiene(Permisos.supervisarPuertas);
  if (clase == ClasePantalla.compacta) {
    // Por prioridad: lo primero que se queda si no caben todos.
    final porPrioridad = [
      if (sesion.tiene(Permisos.verQr)) DestinoNav.misQr,
      if (administra) DestinoNav.admin else if (supervisa) DestinoNav.puertas,
      if (sesion.tiene(Permisos.verEventos)) DestinoNav.eventos,
    ].take(maxDestinosCompactos - 2).toSet();
    // Y se muestran en el orden de siempre.
    const ordenVisible = [
      DestinoNav.misQr,
      DestinoNav.eventos,
      DestinoNav.admin,
      DestinoNav.puertas,
    ];
    return [
      DestinoNav.inicio,
      ...ordenVisible.where(porPrioridad.contains),
      DestinoNav.perfil,
    ];
  }
  return [
    DestinoNav.inicio,
    if (sesion.tiene(Permisos.generarQr)) DestinoNav.generarQr,
    if (!administra && sesion.tiene(Permisos.verQr)) DestinoNav.misQr,
    if (sesion.tiene(Permisos.verEventos)) DestinoNav.eventos,
    if (supervisa) DestinoNav.puertas,
    if (administra) DestinoNav.usuarios,
    DestinoNav.perfil,
  ];
}

/// El guardia ve los eventos de sus puertas asignadas y tiene su QR propio
/// (`generarQrPropio`), pero no genera QR de visitas (`generarQr`, de los
/// demás roles). Se reconoce por lo que puede ver, no por el nombre del rol.
bool esGuardia(SesionEstado sesion) =>
    sesion.tiene(Permisos.verEventosAsignados) &&
    !sesion.tiene(Permisos.verTodosLosEventos);

/// El tablero del administrador (indicadores y últimos eventos) es para quien
/// supervisa puertas y ve todos los eventos; el resto ve el inicio de usuario.
bool veTableroDeAdministracion(SesionEstado sesion) =>
    sesion.tiene(Permisos.supervisarPuertas) &&
    sesion.tiene(Permisos.verTodosLosEventos);
