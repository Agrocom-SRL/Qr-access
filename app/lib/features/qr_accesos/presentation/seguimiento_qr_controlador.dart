import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;

/// Qué pasó con un QR (por id): su estado y el último intento de lectura. Se
/// vuelve a pedir con `ref.invalidate` mientras el QR está en pantalla; al
/// salir se descarta.
final FutureProviderFamily<SeguimientoQr, String> seguimientoQrProvider =
    FutureProvider.autoDispose.family<SeguimientoQr, String>(
      (ref, id) => ref.watch(qrAccesosRepositorioProvider).seguir(id),
    );
