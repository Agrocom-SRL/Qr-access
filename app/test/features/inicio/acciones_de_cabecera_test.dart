import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/acciones_de_cabecera.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/boton_qr_propio.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/notificaciones_falsas.dart';
import '../../helpers/pantalla.dart';

/// La bandeja en memoria: el contador no sale a la red desde el test.
final Override _bandejaVacia = notificacionesRepositorioProvider
    .overrideWithValue(NotificacionesRepositorioFalso());

void main() {
  testWidgets('sin bandeja ni QR propio no hay acciones que mostrar', (
    tester,
  ) async {
    expect(accionesDeCabecera(sesionCon(), qrPropio: false), isNull);
  });

  testWidgets('la bandeja aparece solo con su permiso de cuenta', (
    tester,
  ) async {
    final conBandeja = accionesDeCabecera(
      sesionCon(permisos: {Permisos.verNotificaciones}),
      qrPropio: false,
    );
    expect(conBandeja, isNotNull);

    await montarPantalla(
      tester,
      pagina: Scaffold(body: conBandeja),
      overrides: [_bandejaVacia],
    );
    expect(find.byType(BotonNotificaciones), findsOneWidget);
    expect(find.byType(BotonQrPropio), findsNothing);
  });

  testWidgets('la bandeja y el QR propio van juntos cuando hay los dos', (
    tester,
  ) async {
    final acciones = accionesDeCabecera(
      sesionCon(permisos: {Permisos.verNotificaciones}),
      qrPropio: true,
    );

    await montarPantalla(
      tester,
      pagina: Scaffold(body: acciones),
      overrides: [_bandejaVacia],
    );
    expect(find.byType(BotonNotificaciones), findsOneWidget);
    expect(find.byType(BotonQrPropio), findsOneWidget);
  });
}
