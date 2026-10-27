import 'package:agrocom_acceso/core/plataforma/almacen_instalacion_contrato.dart';
import 'package:web/web.dart' as web;

/// Implementación web: el `localStorage` del navegador. A diferencia del
/// refresco (sessionStorage, por pestaña), la instalación debe ser la misma en
/// todas las pestañas de un navegador; no es un secreto, así que no hay
/// riesgo en guardarla ahí.
class AlmacenInstalacionWeb implements AlmacenInstalacion {
  static const _clave = 'instalacion.id';

  /// En memoria por si el navegador bloquea el almacenamiento: la instalación
  /// dura entonces lo que la pestaña, sin romper el inicio de sesión.
  String? _respaldo;

  @override
  Future<String?> leer() async {
    try {
      return web.window.localStorage.getItem(_clave) ?? _respaldo;
    } on Object {
      return _respaldo;
    }
  }

  @override
  Future<void> guardar(String instalacionId) async {
    _respaldo = instalacionId;
    try {
      web.window.localStorage.setItem(_clave, instalacionId);
    } on Object {
      // Sin almacenamiento disponible queda solo el respaldo en memoria.
    }
  }
}

/// Fábrica que elige `almacen_instalacion.dart` por importación condicional.
AlmacenInstalacion crearAlmacenInstalacion() => AlmacenInstalacionWeb();
