import 'package:agrocom_acceso/core/plataforma/almacen_pin.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/fila_mi_pin.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

class _AlmacenPinFalso implements AlmacenPin {
  new({this.disponible = true, this.pin});

  @override
  final bool disponible;
  String? pin;

  @override
  Future<String?> leer() async => pin;

  @override
  Future<void> guardar(String valor) async => pin = valor;

  @override
  Future<void> borrar() async => pin = null;
}

Future<void> _montar(WidgetTester tester, AlmacenPin almacen) async {
  await montarPantalla(
    tester,
    pagina: const Scaffold(body: FilaMiPin()),
    overrides: [almacenPinProvider.overrideWithValue(almacen)],
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('el PIN va oculto, el ojo lo muestra y se vuelve a tapar solo', (
    tester,
  ) async {
    await _montar(tester, _AlmacenPinFalso(pin: 'AGR7K2Q'));
    final textos = textosEn(tester);

    expect(find.text('AGR7K2Q'), findsNothing);
    expect(find.text('•' * 7), findsOneWidget);

    await tester.tap(find.byTooltip(textos.perfilMiPinMostrar));
    await tester.pump();
    expect(find.text('AGR7K2Q'), findsOneWidget);

    await tester.pump(const Duration(seconds: 11));
    expect(find.text('AGR7K2Q'), findsNothing);
  });

  testWidgets('copiar deja el PIN en el portapapeles y lo avisa', (
    tester,
  ) async {
    String? copiado;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (llamada) async {
        if (llamada.method == 'Clipboard.setData') {
          copiado = (llamada.arguments as Map)['text'] as String?;
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    await _montar(tester, _AlmacenPinFalso(pin: 'AGR7K2Q'));
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.perfilMiPinCopiar));
    await tester.pump();

    expect(copiado, 'AGR7K2Q');
    expect(find.text(textos.perfilMiPinCopiado), findsOneWidget);
  });

  testWidgets('sin PIN guardado explica cómo verlo', (tester) async {
    await _montar(tester, _AlmacenPinFalso());
    expect(find.text(textosEn(tester).perfilMiPinNoGuardado), findsOneWidget);
  });

  testWidgets('donde no se guarda el PIN (web) la fila no aparece', (
    tester,
  ) async {
    await _montar(tester, _AlmacenPinFalso(disponible: false, pin: 'AGR7K2Q'));
    expect(find.text(textosEn(tester).perfilMiPin), findsNothing);
  });
}
