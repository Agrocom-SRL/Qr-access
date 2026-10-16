import 'package:agrocom_acceso/core/plataforma/almacen_qr_contrato.dart';
// La implementación depende de la plataforma: en web, memoria; en móvil,
// almacén seguro (ADR 0012). Se importa y se exporta por la misma razón que
// `almacen_refresco.dart`.
import 'package:agrocom_acceso/core/plataforma/almacen_qr_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/almacen_qr_movil.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:agrocom_acceso/core/plataforma/almacen_qr_contrato.dart';

/// Almacén de los textos de QR emitidos, según la plataforma.
final almacenQrProvider = Provider<AlmacenQr>((ref) => crearAlmacenQr());
