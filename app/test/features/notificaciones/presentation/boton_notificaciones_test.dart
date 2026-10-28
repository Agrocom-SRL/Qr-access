import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/notificaciones_falsas.dart';
import '../../../helpers/pantalla.dart';

void main() {
  testWidgets('muestra el contador de lo que falta por leer', (tester) async {
    await montarPantalla(
      tester,
      pagina: const BotonNotificaciones(),
      overrides: [
        notificacionesRepositorioProvider.overrideWithValue(
          NotificacionesRepositorioFalso(noLeidas: 3),
        ),
      ],
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('3'), findsOneWidget);
    expect(
      find.byTooltip((await textosDe()).notificacionesAbrir),
      findsOneWidget,
    );
  });

  testWidgets('sin nada por leer, no muestra número', (tester) async {
    await montarPantalla(
      tester,
      pagina: const BotonNotificaciones(),
      overrides: [
        notificacionesRepositorioProvider.overrideWithValue(
          NotificacionesRepositorioFalso(),
        ),
      ],
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(Badge), findsOneWidget);
    expect(find.text('0'), findsNothing);
  });

  testWidgets('abre la bandeja al tocarlo', (tester) async {
    await montarPantalla(
      tester,
      pagina: const BotonNotificaciones(),
      overrides: [
        notificacionesRepositorioProvider.overrideWithValue(
          NotificacionesRepositorioFalso(noLeidas: 1),
        ),
      ],
    );
    await tester.pump();

    await tester.tap(find.byType(IconButton));
    await tester.pumpAndSettle();

    expect(find.text('destino /notificaciones'), findsOneWidget);
  });
}
