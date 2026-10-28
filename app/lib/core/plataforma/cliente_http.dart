import 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_contrato.dart';
// Lo específico del cliente HTTP por plataforma (ADR 0012, regla de web y
// móvil con el mismo código). Se importa y se exporta por la misma razón que
// `almacen_refresco.dart`.
import 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_movil.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_contrato.dart';

/// Ajustes del cliente HTTP según la plataforma.
final ajustesClienteHttpProvider = Provider<AjustesClienteHttp>(
  (ref) => crearAjustesClienteHttp(),
);
