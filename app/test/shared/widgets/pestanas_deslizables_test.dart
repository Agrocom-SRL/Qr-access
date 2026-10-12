import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/pestanas_deslizables.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<List<String>> _montar(
  WidgetTester tester, {
  String inicial = 'a',
}) async {
  final elegidas = <String>[];
  var actual = inicial;
  await tester.pumpWidget(
    MaterialApp(
      theme: Tema.claro,
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) => PestanasDeslizables<String>(
            segmentos: const [
              SegmentoDeSelector(valor: 'a', etiqueta: 'Uno'),
              SegmentoDeSelector(valor: 'b', etiqueta: 'Dos'),
              SegmentoDeSelector(valor: 'c', etiqueta: 'Tres'),
            ],
            seleccionado: actual,
            alElegir: (v) => setState(() {
              actual = v;
              elegidas.add(v);
            }),
            paginaDe: (context, valor) => Center(child: Text('página $valor')),
          ),
        ),
      ),
    ),
  );
  return elegidas;
}

void main() {
  testWidgets('deslizar de lado acompaña al dedo y elige la vecina', (
    tester,
  ) async {
    final elegidas = await _montar(tester);

    await tester.fling(find.text('página a'), const Offset(-400, 0), 1500);
    await tester.pumpAndSettle();

    expect(elegidas, ['b']);
    expect(find.text('página b'), findsOneWidget);
  });

  testWidgets('tocar una pestaña anima hasta su página', (tester) async {
    final elegidas = await _montar(tester);

    await tester.tap(find.text('Tres'));
    await tester.pumpAndSettle();

    expect(elegidas, ['c']);
    expect(find.text('página c'), findsOneWidget);
  });
}
