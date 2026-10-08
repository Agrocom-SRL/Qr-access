import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/features/sesion/sesion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _envolver(Widget hijo, ThemeData tema) => MaterialApp(
  theme: tema,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: hijo,
);

void main() {
  for (final (nombre, tema) in [
    ('claro', Tema.claro),
    ('oscuro', Tema.oscuro),
  ]) {
    testWidgets('el ingreso pide cuenta y PIN (tema $nombre)', (tester) async {
      await tester.pumpWidget(_envolver(const IngresoPagina(), tema));
      final l10n = AppLocalizations.of(
        tester.element(find.byType(IngresoPagina)),
      );

      expect(find.text(l10n.sesionIngresoTitulo), findsOneWidget);
      expect(find.text(l10n.sesionCampoCuenta), findsOneWidget);
      expect(find.text(l10n.sesionCampoPin), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(2));
    });
  }

  testWidgets('el PIN solo acepta dígitos y no se muestra', (tester) async {
    await tester.pumpWidget(_envolver(const IngresoPagina(), Tema.claro));
    final pin = find.byType(TextField).last;
    await tester.enterText(pin, '12ab34');

    final editable = tester.widget<EditableText>(
      find.descendant(of: pin, matching: find.byType(EditableText)),
    );
    expect(editable.controller.text, '1234');
    expect(editable.obscureText, isTrue);
  });

  testWidgets('el botón Ingresar queda deshabilitado hasta la HU-04', (
    tester,
  ) async {
    await tester.pumpWidget(_envolver(const IngresoPagina(), Tema.claro));
    final boton = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(boton.onPressed, isNull);
  });
}
