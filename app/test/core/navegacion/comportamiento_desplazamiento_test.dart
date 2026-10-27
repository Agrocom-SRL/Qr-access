import 'package:agrocom_acceso/core/navegacion/comportamiento_desplazamiento.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Monta una lista con tirar para actualizar y cuenta cuántas veces se pide.
Future<int Function()> _montarListaActualizable(
  WidgetTester tester, {
  ScrollBehavior? comportamiento,
}) async {
  var actualizaciones = 0;
  await tester.pumpWidget(
    MaterialApp(
      scrollBehavior: comportamiento,
      home: Scaffold(
        body: RefreshIndicator(
          onRefresh: () async => actualizaciones++,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [SizedBox(height: 1200)],
          ),
        ),
      ),
    ),
  );
  return () => actualizaciones;
}

/// Arrastra hacia abajo con un puntero del [tipo] y suelta.
Future<void> _tirarHaciaAbajo(
  WidgetTester tester,
  PointerDeviceKind tipo,
) async {
  final gesto = await tester.startGesture(
    tester.getCenter(find.byType(ListView)),
    kind: tipo,
  );
  await gesto.moveBy(const Offset(0, 300));
  await gesto.up();
  await tester.pumpAndSettle();
}

void main() {
  test('el comportamiento de la app arrastra con tacto, mouse, lápiz y '
      'trackpad', () {
    const comportamiento = ComportamientoDesplazamientoAcceso();

    expect(
      comportamiento.dragDevices,
      containsAll(<PointerDeviceKind>{
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.stylus,
        PointerDeviceKind.trackpad,
      }),
    );
  });

  testWidgets('con el comportamiento de la app, tirar con el mouse pide la '
      'lista de nuevo', (tester) async {
    final actualizaciones = await _montarListaActualizable(
      tester,
      comportamiento: const ComportamientoDesplazamientoAcceso(),
    );

    await _tirarHaciaAbajo(tester, PointerDeviceKind.mouse);

    expect(actualizaciones(), 1);
  });

  testWidgets('sin ese comportamiento, el mouse no tira de la lista (por '
      'qué hace falta el comportamiento de la app)', (tester) async {
    final actualizaciones = await _montarListaActualizable(tester);

    await _tirarHaciaAbajo(tester, PointerDeviceKind.mouse);

    expect(actualizaciones(), 0);
  });

  testWidgets('con el comportamiento de la app, el tacto sigue tirando de la '
      'lista', (tester) async {
    final actualizaciones = await _montarListaActualizable(
      tester,
      comportamiento: const ComportamientoDesplazamientoAcceso(),
    );

    await _tirarHaciaAbajo(tester, PointerDeviceKind.touch);

    expect(actualizaciones(), 1);
  });
}
