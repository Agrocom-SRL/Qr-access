import 'package:agrocom_acceso/core/plataforma/almacen_refresco_contrato.dart';
// La implementación depende de la plataforma: en web, memoria; en móvil,
// almacén seguro (ADR 0012, regla de web y móvil con el mismo código).
// Se importa y se exporta: `export` solo no trae los nombres a este archivo.
import 'package:agrocom_acceso/core/plataforma/almacen_refresco_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/almacen_refresco_movil.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:agrocom_acceso/core/plataforma/almacen_refresco_contrato.dart';
export 'package:agrocom_acceso/core/plataforma/almacen_refresco_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/almacen_refresco_movil.dart';

/// Almacén del refresco de la sesión, según la plataforma.
final almacenRefrescoProvider = Provider<AlmacenRefresco>(
  (ref) => crearAlmacenRefresco(),
);
