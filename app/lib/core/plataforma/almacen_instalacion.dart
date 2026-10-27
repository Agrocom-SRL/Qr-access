import 'package:agrocom_acceso/core/plataforma/almacen_instalacion_contrato.dart';
// La implementación depende de la plataforma (ADR 0012, web y móvil con el
// mismo código). Se importa y se exporta por la misma razón que
// `almacen_refresco.dart`.
import 'package:agrocom_acceso/core/plataforma/almacen_instalacion_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/almacen_instalacion_movil.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:agrocom_acceso/core/plataforma/almacen_instalacion_contrato.dart';
export 'package:agrocom_acceso/core/plataforma/almacen_instalacion_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/almacen_instalacion_movil.dart';

/// Almacén de la instalación, según la plataforma.
final almacenInstalacionProvider = Provider<AlmacenInstalacion>(
  (ref) => crearAlmacenInstalacion(),
);
