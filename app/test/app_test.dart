import 'package:agrocom_acceso/app.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/fakes.dart';

/// Integración de la raíz: la guarda de sesión decide la primera pantalla.
void main() {
  testWidgets('sin sesión, la app abre el ingreso', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [sesionControladorProvider.overrideWith(SesionFalsa.new)],
        child: const AccesoApp(),
      ),
    );
    await tester.pumpAndSettle();

    final textos = AppLocalizations.of(
      tester.element(find.byType(Scaffold).first),
    );
    expect(find.text(textos.sesionIngresoTitulo), findsOneWidget);
  });

  testWidgets('con sesión, el ingreso lleva al tablero', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sesionControladorProvider.overrideWith(
            () => SesionFalsa(sesionCon(permisos: {Permisos.emitirQr})),
          ),
        ],
        child: const AccesoApp(),
      ),
    );
    await tester.pumpAndSettle();

    final textos = AppLocalizations.of(
      tester.element(find.byType(Scaffold).first),
    );
    expect(find.text(textos.inicioTitulo), findsOneWidget);
    expect(find.text(textos.sesionIngresoTitulo), findsNothing);
  });
}
