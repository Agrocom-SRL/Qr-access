import 'package:agrocom_acceso/core/plataforma/almacen_pin_contrato.dart';
import 'package:web/web.dart' as web;

/// Implementación web: guarda el PIN en el `localStorage` del navegador para
/// que la persona no tenga que recordarlo ni ingresar de nuevo.
///
/// Es una decisión consciente y temporal del primer lanzamiento, que corre en
/// un entorno controlado mientras las tiendas aprueban las apps (ADR 0018,
/// enmienda de 2026-11-07): el navegador no tiene almacén seguro, así que un
/// script ajeno (XSS) o quien use ese equipo podría leerlo. Se mitiga con la
/// CSP de la API y se cierra cuando se pueda guardar de forma segura en web.
/// El servidor sigue guardando solo el hash del PIN (ADR 0018 §3).
class AlmacenPinWeb implements AlmacenPin {
  static const _clave = 'sesion.pin';

  @override
  bool get disponible => true;

  /// En web no hay almacén seguro para el refresco: si la cookie vence o se
  /// pierde, la sesión se rehace sola con el PIN guardado.
  @override
  bool get reingresoAutomatico => true;

  @override
  Future<String?> leer() async {
    try {
      return web.window.localStorage.getItem(_clave);
    } on Object {
      // Navegación privada o almacenamiento bloqueado: sin PIN recordado.
      return null;
    }
  }

  @override
  Future<void> guardar(String pin) async {
    web.window.localStorage.setItem(_clave, pin);
  }

  @override
  Future<void> borrar() async {
    try {
      web.window.localStorage.removeItem(_clave);
    } on Object {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  }
}

/// Fábrica que elige `almacen_pin.dart` por importación condicional.
AlmacenPin crearAlmacenPin() => AlmacenPinWeb();
