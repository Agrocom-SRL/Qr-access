import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla_completa.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

/// Tamaño de un QR entero en pantalla (visual de prueba, cuadrado).
const _ladoVisual = 272.0;

Future<void> _montar(
  WidgetTester tester, {
  required Size tamano,
  bool conVisual = true,
}) => montarPantalla(
  tester,
  tamano: tamano,
  pagina: PlantillaPantallaCompleta(
    titulo: 'Título',
    alCerrar: () {},
    visual: conVisual
        ? const SizedBox.square(key: ValueKey('visual'), dimension: _ladoVisual)
        : null,
    pie: FilledButton(
      key: const ValueKey('pie'),
      onPressed: () {},
      child: const Text('Acción'),
    ),
    child: const Text('Datos', key: ValueKey('datos')),
  ),
);

Rect _rect(WidgetTester tester, String clave) =>
    tester.getRect(find.byKey(ValueKey(clave)));

void main() {
  testWidgets(
    'en teléfono horizontal, el visual va entero a la izquierda y los '
    'datos y la acción a la derecha',
    (tester) async {
      await _montar(tester, tamano: tamanoApaisado);

      final visual = _rect(tester, 'visual');
      final datos = _rect(tester, 'datos');
      final pie = _rect(tester, 'pie');
      expect(visual.width, _ladoVisual);
      expect(visual.height, _ladoVisual);
      expect(visual.top, greaterThanOrEqualTo(0));
      expect(visual.bottom, lessThanOrEqualTo(tamanoApaisado.height));
      expect(visual.right, lessThanOrEqualTo(datos.left));
      expect(pie.left, greaterThanOrEqualTo(datos.left));
      expect(pie.bottom, lessThanOrEqualTo(tamanoApaisado.height));
      expect(pie.overlaps(visual), isFalse);
    },
  );

  testWidgets(
    'en vertical, el visual va encima de los datos y la acción abajo',
    (tester) async {
      await _montar(tester, tamano: tamanoCompacto);

      final visual = _rect(tester, 'visual');
      final datos = _rect(tester, 'datos');
      final pie = _rect(tester, 'pie');
      expect(visual.bottom, lessThanOrEqualTo(datos.top));
      expect(datos.bottom, lessThanOrEqualTo(pie.top));
    },
  );

  testWidgets('un teléfono en vertical (393×852) conserva la columna', (
    tester,
  ) async {
    await _montar(tester, tamano: const Size(393, 852));

    final visual = _rect(tester, 'visual');
    final datos = _rect(tester, 'datos');
    expect(visual.bottom, lessThanOrEqualTo(datos.top));
  });

  testWidgets('una tablet en horizontal (800×600) no se parte en columnas', (
    tester,
  ) async {
    await _montar(tester, tamano: const Size(800, 600));

    final visual = _rect(tester, 'visual');
    final datos = _rect(tester, 'datos');
    expect(visual.bottom, lessThanOrEqualTo(datos.top));
  });

  testWidgets('sin visual, en horizontal sigue en una sola columna', (
    tester,
  ) async {
    await _montar(tester, tamano: tamanoApaisado, conVisual: false);

    expect(find.byKey(const ValueKey('visual')), findsNothing);
    final datos = _rect(tester, 'datos');
    final pie = _rect(tester, 'pie');
    expect(datos.bottom, lessThanOrEqualTo(pie.top));
    expect(pie.bottom, lessThanOrEqualTo(tamanoApaisado.height));
  });
}
