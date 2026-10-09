import 'package:agrocom_acceso/shared/widgets/molecules/desliza_entre_opciones.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<List<String>> _montar(
  WidgetTester tester, {
  required String inicial,
  bool activo = true,
}) async {
  final elegidas = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      home: DeslizaEntreOpciones<String>(
        activo: activo,
        opciones: const ['a', 'b', 'c'],
        seleccionada: inicial,
        alCambiar: elegidas.add,
        child: const SizedBox.expand(),
      ),
    ),
  );
  return elegidas;
}

void main() {
  testWidgets('deslizar a la izquierda pasa a la opción siguiente', (
    tester,
  ) async {
    final elegidas = await _montar(tester, inicial: 'a');
    await tester.fling(find.byType(SizedBox), const Offset(-300, 0), 1000);
    expect(elegidas, ['b']);
  });

  testWidgets('deslizar a la derecha vuelve a la anterior', (tester) async {
    final elegidas = await _montar(tester, inicial: 'b');
    await tester.fling(find.byType(SizedBox), const Offset(300, 0), 1000);
    expect(elegidas, ['a']);
  });

  testWidgets('en los extremos no hace nada', (tester) async {
    final elegidas = await _montar(tester, inicial: 'a');
    await tester.fling(find.byType(SizedBox), const Offset(300, 0), 1000);
    expect(elegidas, isEmpty);
  });

  testWidgets('un deslizamiento lento no cuenta', (tester) async {
    final elegidas = await _montar(tester, inicial: 'a');
    await tester.fling(find.byType(SizedBox), const Offset(-300, 0), 50);
    expect(elegidas, isEmpty);
  });

  testWidgets('inactivo, no responde', (tester) async {
    final elegidas = await _montar(tester, inicial: 'a', activo: false);
    await tester.fling(find.byType(SizedBox), const Offset(-300, 0), 1000);
    expect(elegidas, isEmpty);
  });
}
