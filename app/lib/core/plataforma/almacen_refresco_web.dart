import 'package:agrocom_acceso/core/plataforma/almacen_refresco_contrato.dart';
import 'package:web/web.dart' as web;

/// Implementación web: no guarda el refresco en ningún sitio que JavaScript
/// pueda leer (ADR 0033 §5). La API lo entrega en la cookie
/// `__Host-refresco-app` (`HttpOnly`, `Secure`, `SameSite=Strict`) y el
/// navegador la envía sola en `POST /sesiones/refresco` y
/// `DELETE /sesiones/actual`.
///
/// Por eso `guardar` no hace nada y `leer` siempre devuelve `null`: un XSS ya
/// no puede llevarse el refresco. Antes vivía en `sessionStorage`; esta clase
/// borra esa clave heredada para que no quede un secreto en el navegador de
/// quien actualiza la app.
class AlmacenRefrescoWeb implements AlmacenRefresco {
  static const _claveHeredada = 'sesion.refresco';

  @override
  bool get viveEnCookie => true;

  @override
  Future<String?> leer() async {
    _borrarClaveHeredada();
    return null;
  }

  @override
  Future<void> guardar(String refresco) async {
    // Intencionado: el refresco ya llegó en la cookie HttpOnly.
  }

  @override
  Future<void> borrar() async => _borrarClaveHeredada();

  void _borrarClaveHeredada() {
    try {
      web.window.sessionStorage.removeItem(_claveHeredada);
    } on Object {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  }
}

/// Fábrica que elige `almacen_refresco.dart` por importación condicional.
AlmacenRefresco crearAlmacenRefresco() => AlmacenRefrescoWeb();
