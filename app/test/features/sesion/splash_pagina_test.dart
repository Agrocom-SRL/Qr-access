import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/splash_estado.dart';
import 'package:agrocom_acceso/features/sesion/sesion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

ProviderContainer _contenedor(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(SplashPagina)));

void main() {
  testWidgets('libera el splash al terminar la animación (≤ 800 ms)', (
    tester,
  ) async {
    await montarPantalla(tester, pagina: const SplashPagina());
    await tester.pump();
    expect(_contenedor(tester).read(splashTerminadoProvider), isFalse);

    await tester.pump(const Duration(milliseconds: 800));
    await tester.pump(const Duration(milliseconds: 16));
    expect(_contenedor(tester).read(splashTerminadoProvider), isTrue);
  });

  testWidgets('con reducir movimiento muestra el logo y libera de inmediato', (
    tester,
  ) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await montarPantalla(tester, pagina: const SplashPagina());
    await tester.pump();

    expect(
      find.byWidgetPredicate(
        (w) =>
            w is Image &&
            w.image is AssetImage &&
            (w.image as AssetImage).assetName == Multimedia.logoPlaca,
      ),
      findsOneWidget,
    );
    expect(_contenedor(tester).read(splashTerminadoProvider), isTrue);
  });
}
