import 'package:agrocom_acceso/features/sesion/presentation/bienvenida_pagina.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

void main() {
  testWidgets('en compacto muestra el hero con la frase e Ingresar', (
    tester,
  ) async {
    await montarPantalla(tester, pagina: const BienvenidaPagina());
    final textos = textosEn(tester);

    expect(find.text(textos.bienvenidaNombreApp), findsOneWidget);
    expect(find.text(textos.bienvenidaFrase), findsOneWidget);
    expect(find.text(textos.bienvenidaSinPin), findsOneWidget);

    await tester.tap(find.text(textos.sesionBotonIngresar));
    await tester.pumpAndSettle();
    expect(find.text('destino /ingreso'), findsOneWidget);
  });

  testWidgets('en expandido tiene panel de marca y título de bienvenida', (
    tester,
  ) async {
    await montarPantalla(
      tester,
      pagina: const BienvenidaPagina(),
      expandida: true,
    );
    final textos = textosEn(tester);

    expect(find.text(textos.bienvenidaTitulo), findsOneWidget);
    expect(find.text(textos.bienvenidaFrase), findsOneWidget);
  });
}
