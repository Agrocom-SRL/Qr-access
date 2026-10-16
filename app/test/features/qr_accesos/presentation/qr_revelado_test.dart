import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/qr_revelado.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/visor_qr.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lottie/lottie.dart';

import '../../../helpers/pantalla.dart';

Future<void> _montar(WidgetTester tester) => montarPantalla(
  tester,
  pagina: const Scaffold(
    body: Center(child: QrRevelado(texto: 'AQ1.abc')),
  ),
);

void main() {
  testWidgets('reproduce el Lottie una vez y luego pasa al QR', (tester) async {
    await _montar(tester);
    await tester.pump();
    expect(find.byType(LottieBuilder), findsOneWidget);
    expect(find.byType(VisorQr), findsNothing);

    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 16));
    await tester.pumpAndSettle();
    expect(find.byType(VisorQr), findsOneWidget);
    expect(find.byType(LottieBuilder), findsNothing);
  });

  testWidgets('con reducir movimiento salta directo al QR', (tester) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await _montar(tester);
    await tester.pump();

    expect(find.byType(VisorQr), findsOneWidget);
    expect(find.byType(LottieBuilder), findsNothing);
  });
}
