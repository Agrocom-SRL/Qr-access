import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';
import '../../helpers/semantica.dart';

void main() {
  testWidgets('volver: flecha, tooltip "Volver" y semántica accesible', (
    tester,
  ) async {
    final semantica = tester.ensureSemantics();
    var pulsado = 0;
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: BotonSalidaCabecera(
          salida: SalidaDeCabecera.volver,
          alPulsar: () => pulsado++,
        ),
      ),
    );
    final textos = textosEn(tester);

    expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    expect(find.byIcon(Icons.close), findsNothing);
    expect(find.byTooltip(textos.comunVolver), findsOneWidget);
    expect(
      textoSemanticoDe(tester, find.byType(IconButton)),
      textos.comunVolver,
    );

    await tester.tap(find.byType(IconButton));
    expect(pulsado, 1);
    semantica.dispose();
  });

  testWidgets('cerrar: X, tooltip "Cerrar" y semántica accesible', (
    tester,
  ) async {
    final semantica = tester.ensureSemantics();
    var pulsado = 0;
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: BotonSalidaCabecera(
          salida: SalidaDeCabecera.cerrar,
          alPulsar: () => pulsado++,
        ),
      ),
    );
    final textos = textosEn(tester);

    expect(find.byIcon(Icons.close), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back), findsNothing);
    expect(find.byTooltip(textos.comunCerrar), findsOneWidget);
    expect(
      textoSemanticoDe(tester, find.byType(IconButton)),
      textos.comunCerrar,
    );

    await tester.tap(find.byType(IconButton));
    expect(pulsado, 1);
    semantica.dispose();
  });

  testWidgets('la zona táctil nunca baja del mínimo del tema', (tester) async {
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: BotonSalidaCabecera(
          salida: SalidaDeCabecera.volver,
          alPulsar: () {},
        ),
      ),
    );
    final minimo = tester.element(find.byType(IconButton)).tokens.tamano;
    final zona = tester.getSize(find.byType(IconButton));

    expect(zona.width, greaterThanOrEqualTo(minimo.controlMinimo));
    expect(zona.height, greaterThanOrEqualTo(minimo.controlMinimo));
  });

  test('"ninguna" no tiene botón: construirlo falla en modo debug', () {
    expect(
      () => BotonSalidaCabecera(
        salida: SalidaDeCabecera.ninguna,
        alPulsar: () {},
      ),
      throwsAssertionError,
    );
  });
}
