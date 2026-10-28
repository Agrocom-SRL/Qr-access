import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Monta un widget con el tamaño y la plataforma dados y devuelve la clase de
/// pantalla que decide `context.clasePantalla`.
Future<ClasePantalla> _clasePara(
  WidgetTester tester, {
  required Size tamano,
  required TargetPlatform plataforma,
}) async {
  tester.view
    ..physicalSize = tamano
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  late ClasePantalla clase;
  // Flutter exige volver a null antes de terminar el test: por eso el finally.
  debugDefaultTargetPlatformOverride = plataforma;
  try {
    await tester.pumpWidget(
      MaterialApp(
        theme: Tema.claro,
        home: Builder(
          builder: (context) {
            clase = context.clasePantalla;
            return const SizedBox();
          },
        ),
      ),
    );
  } finally {
    debugDefaultTargetPlatformOverride = null;
  }
  return clase;
}

void main() {
  group('teléfono (lado corto menor de 600), en vertical y en horizontal', () {
    testWidgets('iPhone en horizontal (852×393) es compacto', (tester) async {
      final clase = await _clasePara(
        tester,
        tamano: const Size(852, 393),
        plataforma: TargetPlatform.iOS,
      );
      expect(clase, ClasePantalla.compacta);
    });

    testWidgets('Android en horizontal (915×412) es compacto', (tester) async {
      final clase = await _clasePara(
        tester,
        tamano: const Size(915, 412),
        plataforma: TargetPlatform.android,
      );
      expect(clase, ClasePantalla.compacta);
    });

    testWidgets('teléfono en vertical (360×800) sigue compacto', (
      tester,
    ) async {
      final clase = await _clasePara(
        tester,
        tamano: const Size(360, 800),
        plataforma: TargetPlatform.android,
      );
      expect(clase, ClasePantalla.compacta);
    });
  });

  group('tablet y escritorio: como antes, por ancho', () {
    testWidgets('1024×768 en tablet es expandido', (tester) async {
      final clase = await _clasePara(
        tester,
        tamano: const Size(1024, 768),
        plataforma: TargetPlatform.iOS,
      );
      expect(clase, ClasePantalla.expandida);
    });

    testWidgets('1280×800 en escritorio es expandido', (tester) async {
      final clase = await _clasePara(
        tester,
        tamano: const Size(1280, 800),
        plataforma: TargetPlatform.macOS,
      );
      expect(clase, ClasePantalla.expandida);
    });

    testWidgets('una ventana de escritorio ancha y baja sigue expandida', (
      tester,
    ) async {
      final clase = await _clasePara(
        tester,
        tamano: const Size(1200, 500),
        plataforma: TargetPlatform.windows,
      );
      expect(clase, ClasePantalla.expandida);
    });

    testWidgets('700×900 en tablet pequeño es medio', (tester) async {
      final clase = await _clasePara(
        tester,
        tamano: const Size(700, 900),
        plataforma: TargetPlatform.android,
      );
      expect(clase, ClasePantalla.media);
    });
  });
}
