/// Guarda el refresco de la sesión entre arranques de la app.
///
/// Solo el refresco: el acceso (JWT corto) vive en memoria. En móvil se
/// guarda cifrado; en web va al sessionStorage (ADR 0022, addendum): la
/// sesión dura mientras la pestaña esté abierta, aunque se recargue. Ver
/// `almacen_refresco_web.dart`.
abstract interface class AlmacenRefresco {
  Future<String?> leer();

  Future<void> guardar(String refresco);

  Future<void> borrar();
}
