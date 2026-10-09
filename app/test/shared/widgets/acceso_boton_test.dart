import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

void main() {
  testWidgets('con cargando muestra el indicador y no responde al toque', (
    tester,
  ) async {
    var pulsaciones = 0;
    await montarPantalla(
      tester,
      pagina: Column(
        children: [
          AccesoBoton(
            texto: 'Guardar',
            cargando: true,
            onPressed: () => pulsaciones++,
          ),
        ],
      ),
    );
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Guardar'), findsNothing);
    await tester.tap(find.byType(FilledButton));
    expect(pulsaciones, 0);
  });

  testWidgets('sin cargando responde al toque con su texto', (tester) async {
    var pulsaciones = 0;
    await montarPantalla(
      tester,
      pagina: AccesoBoton(texto: 'Guardar', onPressed: () => pulsaciones++),
    );
    await tester.pump();

    await tester.tap(find.text('Guardar'));
    expect(pulsaciones, 1);
  });

  testWidgets('el badge muestra su texto, nunca solo el color', (tester) async {
    await montarPantalla(
      tester,
      pagina: const AccesoBadge(texto: 'Anulado', tono: TonoAcceso.peligro),
    );
    await tester.pump();

    expect(find.text('Anulado'), findsOneWidget);
  });
}
