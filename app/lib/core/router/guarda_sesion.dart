import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';

/// Permiso que exige cada ruta protegida. Lo que el rol activo no puede usar
/// no se muestra, y la ruta tampoco se abre por URL (ADR 0004).
const permisoPorRuta = <String, String>{
  Rutas.qrMios: Permisos.verQr,
  Rutas.qrNuevo: Permisos.emitirQr,
  Rutas.qrEmitido: Permisos.emitirQr,
  Rutas.eventos: Permisos.verEventos,
  Rutas.adminPuertas: Permisos.supervisarPuertas,
  Rutas.adminUsuarios: Permisos.verUsuarios,
  Rutas.adminUsuarioNuevo: Permisos.crearUsuarios,
  Rutas.adminUsuarioEditar: Permisos.editarUsuarios,
  Rutas.adminPinGenerado: Permisos.editarUsuarios,
};

/// La pestaña Admin del compacto la abre quien supervisa puertas o ve usuarios.
const Set<String> _permisosDeAdmin = {
  Permisos.supervisarPuertas,
  Permisos.verUsuarios,
};

/// Adónde mandar a la persona según su sesión: `null` si puede quedarse en
/// `ruta`. Función pura para probarla sin router. `ruta` es la ruta
/// declarada (con `:id`), no la dirección concreta.
String? redireccionDeSesion(SesionEstado sesion, String ruta) {
  final destinoSinSesion = switch (sesion) {
    SesionArrancando() => Rutas.arranque,
    SinSesion() => null,
    SesionEligiendoRol() => Rutas.elegirRol,
    SesionAutenticada() => null,
  };
  if (destinoSinSesion != null) {
    return ruta == destinoSinSesion ? null : destinoSinSesion;
  }
  if (sesion is SinSesion) {
    const deEntrada = {Rutas.bienvenida, Rutas.ingreso};
    return deEntrada.contains(ruta) ? null : Rutas.bienvenida;
  }

  // Con sesión, las pantallas de entrada no tienen sentido: van al tablero.
  const pantallasDeEntrada = {
    Rutas.arranque,
    Rutas.bienvenida,
    Rutas.ingreso,
    Rutas.elegirRol,
  };
  if (pantallasDeEntrada.contains(ruta)) return Rutas.inicio;

  if (ruta == Rutas.admin) {
    return _permisosDeAdmin.any(sesion.tiene) ? null : Rutas.inicio;
  }
  final permiso = permisoPorRuta[ruta];
  if (permiso != null && !sesion.tiene(permiso)) return Rutas.inicio;
  return null;
}
