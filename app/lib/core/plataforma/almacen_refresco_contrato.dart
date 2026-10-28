/// Guarda el refresco de la sesión entre arranques de la app.
///
/// Solo el refresco: el acceso (JWT corto) vive en memoria. En móvil se
/// guarda cifrado en el almacén seguro del sistema. En web no se guarda nada
/// en JavaScript: la API lo entrega en una cookie `HttpOnly` que el navegador
/// guarda y envía sola (ADR 0033 §5). Ver `almacen_refresco_web.dart`.
abstract interface class AlmacenRefresco {
  /// `true` si el refresco vive en una cookie del navegador y no en este
  /// almacén. En ese caso la app no tiene nada que leer al arrancar y debe
  /// pedir la renovación igualmente: la cookie viaja sola.
  bool get viveEnCookie;

  Future<String?> leer();

  Future<void> guardar(String refresco);

  Future<void> borrar();
}
