import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

void main() {
  testWidgets('con cargando muestra el spinner y el gerundio, y no responde', (
    tester,
  ) async {
    var pulsaciones = 0;
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: AccesoBoton(
          texto: 'Guardar',
          textoCargando: 'Guardando',
          cargando: true,
          onPressed: () => pulsaciones++,
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Guardando'), findsOneWidget);
    expect(find.text('Guardar'), findsNothing);
    await tester.tap(find.byType(FilledButton));
    expect(pulsaciones, 0);
  });

  testWidgets('sin cargando responde al toque con su texto', (tester) async {
    var pulsaciones = 0;
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: AccesoBoton(texto: 'Guardar', onPressed: () => pulsaciones++),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Guardar'));
    expect(pulsaciones, 1);
  });

  testWidgets('cada variante rinde un botón de Material', (tester) async {
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: Column(
          children: [
            for (final variante in VarianteBoton.values)
              AccesoBoton(
                texto: variante.name,
                variante: variante,
                onPressed: () {},
              ),
          ],
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(FilledButton), findsNWidgets(4));
    expect(find.byType(OutlinedButton), findsOneWidget);
    // texto y peligroTexto
    expect(find.byType(TextButton), findsNWidgets(2));
  });

  testWidgets('el badge muestra su texto, nunca solo el color', (tester) async {
    await montarPantalla(
      tester,
      pagina: const Scaffold(
        body: AccesoBadge(texto: 'Anulado', tono: TonoAcceso.neutro),
      ),
    );
    await tester.pump();

    expect(find.text('Anulado'), findsOneWidget);
  });
}
