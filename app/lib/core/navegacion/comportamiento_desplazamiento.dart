import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Desplazamiento de la app en todos los dispositivos. El de Material solo
/// arrastra con el tacto, así que en web y escritorio no se podía tirar hacia
/// abajo para actualizar una lista (el gesto de sincronizar, ADR 0012: un
/// mismo código para web y móvil). Aquí se suman el mouse, el lápiz y el
/// trackpad.
class ComportamientoDesplazamientoAcceso extends MaterialScrollBehavior {
  const new();

  @override
  Set<PointerDeviceKind> get dragDevices => const {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.stylus,
    PointerDeviceKind.trackpad,
  };
}
