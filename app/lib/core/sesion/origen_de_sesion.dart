import 'dart:math';

import 'package:agrocom_acceso/core/plataforma/almacen_instalacion.dart';
import 'package:agrocom_acceso/core/sesion/instalacion.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// De dónde entra quien inicia sesión: la instalación y la plataforma que la
/// API usa para contar aparatos distintos (ADR 0030 §4.1). No lleva secretos.
@immutable
class OrigenDeSesion {
  const new({required this.instalacionId, required this.plataforma});

  final String instalacionId;

  /// `android`, `ios` o `web`; `null` si la plataforma no es una de esas.
  final String? plataforma;
}

/// Entrega el origen de cada inicio de sesión. La instalación se lee del
/// almacén una vez por ejecución y, si no hay una válida, se genera y guarda.
/// Si el almacén falla, el inicio de sesión no se bloquea: la instalación vale
/// solo mientras dura la ejecución.
class ProveedorOrigenDeSesion {
  new(this._almacen, this._plataforma, {Random? azar})
    : _azar = azar ?? Random.secure();

  final AlmacenInstalacion _almacen;
  final String? _plataforma;
  final Random _azar;

  /// Una sola carga por ejecución: dos inicios a la vez no generan dos ids.
  Future<String>? _instalacion;

  Future<OrigenDeSesion> leer() async => OrigenDeSesion(
    instalacionId: await (_instalacion ??= _cargarOGenerar()),
    plataforma: _plataforma,
  );

  Future<String> _cargarOGenerar() async {
    try {
      final guardada = await _almacen.leer();
      if (guardada != null && esInstalacionIdValido(guardada)) {
        return guardada;
      }
      final nueva = generarInstalacionId(_azar);
      await _almacen.guardar(nueva);
      return nueva;
    } on Object {
      return generarInstalacionId(_azar);
    }
  }
}

/// Origen de los inicios de sesión de esta app.
final origenDeSesionProvider = Provider<ProveedorOrigenDeSesion>(
  (ref) => ProveedorOrigenDeSesion(
    ref.watch(almacenInstalacionProvider),
    plataformaDe(web: kIsWeb, plataforma: defaultTargetPlatform),
  ),
);
