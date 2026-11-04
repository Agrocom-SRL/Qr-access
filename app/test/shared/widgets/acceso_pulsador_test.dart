import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_pulsador.dart';
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

Finder _pulsador() => find.byType(AccesoPulsador);

/// Lo que el lector de pantalla ve del pulsador: su etiqueta y sus estados.
SemanticsData _semantica(WidgetTester tester) => tester
    .getSemantics(find.bySemanticsLabel('Abrir Portón principal'))
    .getSemanticsData();

void main() {
  testWidgets(
    'normal: es un botón habilitado con su etiqueta y responde al toque',
    (tester) async {
      final semantics = tester.ensureSemantics();
      var pulsaciones = 0;
      await montarPantalla(
        tester,
        pagina: Scaffold(
          body: Center(
            child: AccesoPulsador(
              etiqueta: 'Abrir Portón principal',
              alPulsar: () => pulsaciones++,
            ),
          ),
        ),
      );
      await tester.pump();

      final datos = _semantica(tester);
      expect(datos.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(datos.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(find.byType(CircularProgressIndicator), findsNothing);

      await tester.tap(_pulsador());
      expect(pulsaciones, 1);
      semantics.dispose();
    },
  );

  testWidgets(
    'cargando: anillo girando, no responde y se lee como no habilitado',
    (tester) async {
      final semantics = tester.ensureSemantics();
      var pulsaciones = 0;
      await montarPantalla(
        tester,
        pagina: Scaffold(
          body: Center(
            child: AccesoPulsador(
              etiqueta: 'Abrir Portón principal',
              alPulsar: () => pulsaciones++,
              cargando: true,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(_semantica(tester).hasFlag(SemanticsFlag.isEnabled), isFalse);
      await tester.tap(_pulsador());
      expect(pulsaciones, 0);
      semantics.dispose();
    },
  );

  testWidgets(
    'deshabilitado (sin placa en línea): tono apagado y sin respuesta',
    (tester) async {
      final semantics = tester.ensureSemantics();
      await montarPantalla(
        tester,
        pagina: const Scaffold(
          body: Center(
            child: AccesoPulsador(etiqueta: 'Abrir Portón principal'),
          ),
        ),
      );
      await tester.pump();

      final apagado = tester.widget<Opacity>(
        find.descendant(of: _pulsador(), matching: find.byType(Opacity)),
      );
      expect(apagado.opacity, opacidadDeshabilitado);
      expect(_semantica(tester).hasFlag(SemanticsFlag.isEnabled), isFalse);
      semantics.dispose();
    },
  );

  testWidgets('se activa con teclado: Tab le da foco, Enter y Espacio pulsan', (
    tester,
  ) async {
    var pulsaciones = 0;
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: Center(
          child: AccesoPulsador(
            etiqueta: 'Abrir Portón principal',
            alPulsar: () => pulsaciones++,
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    expect(pulsaciones, 1);
    await tester.sendKeyEvent(LogicalKeyboardKey.space);
    expect(pulsaciones, 2);
  });

  testWidgets(
    'con el foco o el puntero encima muestra el aro con el color primario',
    (tester) async {
      await montarPantalla(
        tester,
        pagina: Scaffold(
          body: Center(
            child: AccesoPulsador(
              etiqueta: 'Abrir Portón principal',
              alPulsar: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      Border borde() {
        final caja = tester.widget<AnimatedContainer>(
          find.descendant(
            of: _pulsador(),
            matching: find.byType(AnimatedContainer),
          ),
        );
        return (caja.decoration! as BoxDecoration).border! as Border;
      }

      expect(borde().top.width, 0);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump(const Duraciones().rapida);
      expect(borde().top.width, const Tamanos().bordeFoco);

      final puntero = TestPointer(1, PointerDeviceKind.mouse);
      addTearDown(puntero.removePointer);
      final centro = tester.getCenter(_pulsador());
      await puntero.hover(centro);
      await tester.pump();

      final region = tester.widget<MouseRegion>(
        find
            .descendant(of: _pulsador(), matching: find.byType(MouseRegion))
            .first,
      );
      expect(region.cursor, SystemMouseCursors.click);
    },
  );
}
