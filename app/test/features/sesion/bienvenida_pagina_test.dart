import 'package:agrocom_acceso/features/sesion/presentation/bienvenida_pagina.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

/// Monta la bienvenida y luego cambia el tamaño de la ventana, para probar
/// tamaños que `montarPantalla` no trae de fábrica (vertical del iPhone,
/// tablet, web).
Future<void> _montarEn(WidgetTester tester, Size tamano) async {
  await montarPantalla(tester, pagina: const BienvenidaPagina());
  usarTamano(tester, tamano);
  await tester.pump();
}

Rect _rect(WidgetTester tester, Finder finder) => tester.getRect(finder);

Finder _boton(WidgetTester tester) =>
    find.text(textosEn(tester).sesionBotonIngresar);

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

  group('teléfono en horizontal (852×393)', () {
    testWidgets('el hero va a un lado y las acciones al otro, sin desbordes', (
      tester,
    ) async {
      await montarPantalla(
        tester,
        pagina: const BienvenidaPagina(),
        apaisada: true,
      );
      final textos = textosEn(tester);
      final frase = _rect(tester, find.text(textos.bienvenidaFrase));
      final boton = _rect(tester, _boton(tester));

      // El texto de la marca y el botón quedan en columnas distintas.
      expect(boton.left, greaterThanOrEqualTo(frase.right));
      // Lo que se ve cabe dentro del alto del teléfono.
      expect(boton.bottom, lessThanOrEqualTo(tamanoApaisado.height));
      expect(frase.bottom, lessThanOrEqualTo(tamanoApaisado.height));
      expect(tester.takeException(), isNull);
    });

    testWidgets('Ingresar es visible, alcanzable y navega al ingreso', (
      tester,
    ) async {
      await montarPantalla(
        tester,
        pagina: const BienvenidaPagina(),
        apaisada: true,
      );
      final textos = textosEn(tester);

      expect(_boton(tester).hitTestable(), findsOneWidget);
      await tester.tap(find.text(textos.sesionBotonIngresar));
      await tester.pumpAndSettle();
      expect(find.text('destino /ingreso'), findsOneWidget);
    });

    testWidgets('usa la foto de la bienvenida en el hero', (tester) async {
      await montarPantalla(
        tester,
        pagina: const BienvenidaPagina(),
        apaisada: true,
      );

      expect(
        tester
            .widgetList<Image>(find.byType(Image))
            .any(
              (imagen) =>
                  imagen.image is AssetImage &&
                  (imagen.image as AssetImage).assetName.contains(
                    'bienvenida_edificio',
                  ),
            ),
        isTrue,
      );
    });
  });

  group('los demás tamaños conservan su layout', () {
    testWidgets('vertical (393×852): las acciones quedan debajo del hero', (
      tester,
    ) async {
      await _montarEn(tester, const Size(393, 852));
      final textos = textosEn(tester);
      final frase = _rect(tester, find.text(textos.bienvenidaFrase));
      final boton = _rect(tester, _boton(tester));

      expect(boton.top, greaterThanOrEqualTo(frase.bottom));
      expect(tester.takeException(), isNull);
    });

    // Tablet y web (ancho de 1024 en adelante) siguen en el layout expandido:
    // panel de marca a la izquierda y el título con el botón a la derecha.
    for (final tamano in [const Size(1024, 768), const Size(1280, 800)]) {
      testWidgets(
        'tablet y web (${tamano.width.toInt()}×${tamano.height.toInt()}): '
        'panel de marca a la izquierda y acciones a la derecha',
        (tester) async {
          await _montarEn(tester, tamano);
          final textos = textosEn(tester);
          final frase = _rect(tester, find.text(textos.bienvenidaFrase));
          final ayuda = _rect(tester, find.text(textos.bienvenidaAyuda));
          final boton = _rect(tester, _boton(tester));

          expect(boton.left, greaterThanOrEqualTo(frase.right));
          expect(boton.top, greaterThanOrEqualTo(ayuda.bottom));
          expect(tester.takeException(), isNull);
        },
      );
    }
  });
}
