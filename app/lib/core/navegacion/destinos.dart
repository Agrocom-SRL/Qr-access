import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';

/// Destinos de la navegación principal (handoff §Breakpoints y navegación).
enum DestinoNav {
  inicio(Rutas.inicio),
  emitirQr(Rutas.qrNuevo),
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
/// | Usuario | Inicio · Mis QR · Eventos · Perfil | + Emitir QR |
/// | Guardia | Inicio · Eventos · Puertas · Perfil | igual |
/// | Administrador | Inicio · Eventos · Admin · Perfil | Inicio · Emitir QR ·
///   Eventos · Puertas · Usuarios · Perfil |
///
/// No se mira el nombre del rol sino lo que puede hacer (ADR 0004): un rol a
/// medida cae en la combinación que le corresponda.
List<DestinoNav> destinosPara(SesionEstado sesion, ClasePantalla clase) {
  final administra = sesion.tiene(Permisos.verUsuarios);
  final supervisa = sesion.tiene(Permisos.supervisarPuertas);
  if (clase == ClasePantalla.compacta) {
    final centrales = [
      if (!administra && !supervisa && sesion.tiene(Permisos.verQr))
        DestinoNav.misQr,
      if (sesion.tiene(Permisos.verEventos)) DestinoNav.eventos,
      if (administra) DestinoNav.admin else if (supervisa) DestinoNav.puertas,
    ];
    return [
      DestinoNav.inicio,
      ...centrales.take(maxDestinosCompactos - 2),
      DestinoNav.perfil,
    ];
  }
  return [
    DestinoNav.inicio,
    if (sesion.tiene(Permisos.emitirQr)) DestinoNav.emitirQr,
    if (!administra && sesion.tiene(Permisos.verQr)) DestinoNav.misQr,
    if (sesion.tiene(Permisos.verEventos)) DestinoNav.eventos,
    if (supervisa) DestinoNav.puertas,
    if (administra) DestinoNav.usuarios,
    DestinoNav.perfil,
  ];
}

/// El tablero del administrador (indicadores y últimos eventos) es para quien
/// supervisa puertas y ve todos los eventos; el resto ve el inicio de usuario.
bool veTableroDeAdministracion(SesionEstado sesion) =>
    sesion.tiene(Permisos.supervisarPuertas) &&
    sesion.tiene(Permisos.verTodosLosEventos);
