import 'package:agrocom_acceso/core/plataforma/almacen_cache_contrato.dart';
// La implementación depende de la plataforma: en web, memoria; en móvil,
// SQLite (ADR 0012). Se importa y se exporta por la misma razón que
// `almacen_refresco.dart`.
import 'package:agrocom_acceso/core/plataforma/almacen_cache_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/almacen_cache_movil.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:agrocom_acceso/core/plataforma/almacen_cache_contrato.dart';

/// Caché de respuestas de la API, según la plataforma.
final almacenCacheProvider = Provider<AlmacenCache>(
  (ref) => crearAlmacenCache(),
);
