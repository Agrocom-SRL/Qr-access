import 'package:agrocom_acceso/core/plataforma/almacen_refresco_contrato.dart';

/// Implementación web: el refresco solo vive en memoria. No va a
/// localStorage ni a sessionStorage, que cualquier script de la página podría
/// leer. Al recargar la pestaña hay que volver a ingresar.
///
/// Cuando la API entregue el refresco en una cookie HttpOnly (pendiente), esta
/// clase deja de guardar nada y el navegador la envía sola.
class AlmacenRefrescoWeb implements AlmacenRefresco {
  String? _refresco;

  @override
  Future<String?> leer() async => _refresco;

  @override
  Future<void> guardar(String refresco) async => _refresco = refresco;

  @override
  Future<void> borrar() async => _refresco = null;
}

/// Fábrica que elige `almacen_refresco.dart` por importación condicional.
AlmacenRefresco crearAlmacenRefresco() => AlmacenRefrescoWeb();
