import 'package:agrocom_acceso/core/plataforma/almacen_refresco_contrato.dart';
import 'package:web/web.dart' as web;

/// Implementación web: el refresco vive en el `sessionStorage` de la pestaña,
/// así recargar la página no cierra la sesión (ADR 0022, addendum). Se borra
/// al cerrar la pestaña o la sesión; nunca va a `localStorage`.
///
/// Riesgo asumido: un script inyectado (XSS) podría leerlo. Cuando la API
/// entregue el refresco en una cookie HttpOnly (pendiente), esta clase deja de
/// guardar nada y el navegador la envía sola.
class AlmacenRefrescoWeb implements AlmacenRefresco {
  static const _clave = 'sesion.refresco';

  /// En memoria por si el navegador bloquea el almacenamiento (modo privado
  /// estricto): la sesión dura entonces hasta recargar, como antes.
  String? _respaldo;

  @override
  Future<String?> leer() async {
    try {
      return web.window.sessionStorage.getItem(_clave) ?? _respaldo;
    } on Object {
      return _respaldo;
    }
  }

  @override
  Future<void> guardar(String refresco) async {
    _respaldo = refresco;
    try {
      web.window.sessionStorage.setItem(_clave, refresco);
    } on Object {
      // Sin almacenamiento disponible: queda solo el respaldo en memoria.
    }
  }

  @override
  Future<void> borrar() async {
    _respaldo = null;
    try {
      web.window.sessionStorage.removeItem(_clave);
    } on Object {
      // Nada que borrar si el navegador no deja usar el almacenamiento.
    }
  }
}

/// Fábrica que elige `almacen_refresco.dart` por importación condicional.
AlmacenRefresco crearAlmacenRefresco() => AlmacenRefrescoWeb();
