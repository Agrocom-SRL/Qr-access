import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/cabecera_titulo.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

const _titulo = 'Lecturas de hoy';
const _subtitulo = 'Lo que entró y lo que no';

/// Monta una cabecera sola, en el ancho de [tamano] (compacto por defecto).
Future<void> _montar(
  WidgetTester tester, {
  required CabeceraTitulo cabecera,
  Size? tamano,
}) async {
  await montarPantalla(
    tester,
    pagina: Scaffold(
      body: Padding(padding: const EdgeInsets.all(16), child: cabecera),
    ),
    expandida: tamano == tamanoExpandido,
  );
  if (tamano != null && tamano != tamanoExpandido) {
    tester.view.physicalSize = tamano;
    await tester.pump();
  }
}

void main() {
  group('estilo del título según la clase de pantalla', () {
    testWidgets('en compacto (360) es de 20, el de la barra de Generar QR', (
      tester,
    ) async {
      await _montar(tester, cabecera: const CabeceraTitulo(titulo: _titulo));

      final estilo = tester.widget<Text>(find.text(_titulo)).style;
      expect(estilo?.fontSize, 20);
      expect(
        estilo?.fontWeight,
        Tema.claro.textTheme.headlineSmall?.fontWeight,
      );
      expect(
        estilo?.fontFamily,
        Tema.claro.textTheme.headlineSmall?.fontFamily,
      );
    });

    testWidgets('en medio (800) es de 32', (tester) async {
      await _montar(
        tester,
        cabecera: const CabeceraTitulo(titulo: _titulo),
        tamano: const Size(800, 900),
      );

      final estilo = tester.widget<Text>(find.text(_titulo)).style;
      expect(estilo?.fontSize, 32);
      expect(
        estilo?.fontWeight,
        Tema.claro.textTheme.headlineLarge?.fontWeight,
      );
      expect(
        estilo?.fontFamily,
        Tema.claro.textTheme.headlineLarge?.fontFamily,
      );
    });

    testWidgets('en expandido (1440) es de 32', (tester) async {
      await _montar(
        tester,
        cabecera: const CabeceraTitulo(titulo: _titulo),
        tamano: tamanoExpandido,
      );

      final estilo = tester.widget<Text>(find.text(_titulo)).style;
      expect(estilo?.fontSize, 32);
    });
  });

  testWidgets('sin subtítulo solo pinta el título', (tester) async {
    await _montar(tester, cabecera: const CabeceraTitulo(titulo: _titulo));

    expect(find.text(_titulo), findsOneWidget);
    expect(find.text(_subtitulo), findsNothing);
  });

  testWidgets('con subtítulo lo pinta debajo, en el secundario', (
    tester,
  ) async {
    await _montar(
      tester,
      cabecera: const CabeceraTitulo(titulo: _titulo, subtitulo: _subtitulo),
    );

    expect(find.text(_subtitulo), findsOneWidget);
    final color = tester.widget<Text>(find.text(_subtitulo)).style?.color;
    final tokens = Tema.claro.extension<AccesoTokens>()!;
    expect(color, tokens.colores.textoSecundario);
  });

  testWidgets('con acción, la muestra a la derecha del título', (tester) async {
    await _montar(
      tester,
      cabecera: const CabeceraTitulo(titulo: _titulo, accion: Text('Exportar')),
    );

    expect(find.text('Exportar'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Exportar')).dx,
      greaterThan(tester.getTopRight(find.text(_titulo)).dx),
    );
  });

  testWidgets('sin salida no hay botón', (tester) async {
    await _montar(tester, cabecera: const CabeceraTitulo(titulo: _titulo));

    expect(find.byType(BotonSalidaCabecera), findsNothing);
    expect(find.byType(IconButton), findsNothing);
  });

  testWidgets('volver pone la flecha y al pulsarla llama a alSalir', (
    tester,
  ) async {
    var salidas = 0;
    await _montar(
      tester,
      cabecera: CabeceraTitulo(
        titulo: _titulo,
        salida: SalidaDeCabecera.volver,
        alSalir: () => salidas++,
      ),
    );

    expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    await tester.tap(find.byType(IconButton));
    expect(salidas, 1);
  });

  testWidgets('cerrar pone la X', (tester) async {
    await _montar(
      tester,
      cabecera: CabeceraTitulo(
        titulo: _titulo,
        salida: SalidaDeCabecera.cerrar,
        alSalir: () {},
      ),
    );

    expect(find.byIcon(Icons.close), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back), findsNothing);
  });

  test('una salida sin qué hacer al pulsarla falla en modo debug', () {
    expect(
      () => CabeceraTitulo(titulo: _titulo, salida: SalidaDeCabecera.volver),
      throwsAssertionError,
    );
  });
}
