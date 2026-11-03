import 'package:agrocom_acceso/core/plataforma/almacen_pin_contrato.dart';
// La implementación depende de la plataforma: móvil guarda en el almacén
// seguro; web no guarda nada (ver `almacen_pin_contrato.dart`).
import 'package:agrocom_acceso/core/plataforma/almacen_pin_web.dart'
    if (dart.library.io) 'package:agrocom_acceso/core/plataforma/almacen_pin_movil.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:agrocom_acceso/core/plataforma/almacen_pin_contrato.dart';

/// Almacén del PIN propio, según la plataforma.
final almacenPinProvider = Provider<AlmacenPin>((ref) => crearAlmacenPin());

/// El PIN guardado en este teléfono, o `null` si no hay (web, o se ingresó
/// antes de que la app lo guardara).
final FutureProvider<String?> pinGuardadoProvider =
    FutureProvider.autoDispose<String?>((ref) async {
      final almacen = ref.watch(almacenPinProvider);
      if (!almacen.disponible) return null;
      try {
        return await almacen.leer();
      } on Object {
        return null;
      }
    });
