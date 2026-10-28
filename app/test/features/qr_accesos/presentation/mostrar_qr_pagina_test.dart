import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mostrar_qr_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/visor_qr.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

final _qr = QrGenerado(
  id: 'qr1',
  texto: 'AQ1.token-de-prueba',
  venceAt: DateTime.utc(2026, 10, 9, 23, 59),
  etiqueta: 'Proveedor de gas',
  puertas: const [
    PuertaDeQr(id: 'p1', nombre: 'Portón principal'),
    PuertaDeQr(id: 'p2', nombre: 'Depósito'),
  ],
);

Future<CompartirFalso> _montar(
  WidgetTester tester, {
  QrGenerado? qr,
  bool apaisada = false,
  Size? tamano,
}) async {
  final compartir = CompartirFalso();
  await montarPantalla(
    tester,
    pagina: MostrarQrPagina(qr: qr ?? _qr),
    apaisada: apaisada,
    tamano: tamano,
    overrides: [
      compartirImagenProvider.overrideWithValue(compartir),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  // El Lottie de generación dura 1 s y el QR entra en 300 ms.
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(milliseconds: 16));
  await tester.pump(const Duration(milliseconds: 300));
  return compartir;
}

void main() {
  testWidgets('muestra el QR con su etiqueta, puertas y vencimiento de hoy', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    expect(find.bySemanticsLabel(textos.qrVisorEtiqueta), findsOneWidget);
    expect(find.text('Proveedor de gas'), findsOneWidget);
    expect(find.text('Portón principal · Depósito'), findsOneWidget);
    expect(
      find.text(textos.qrVenceHoyALas(formatearHoraDe(_qr.venceAt))),
      findsOneWidget,
    );
    expect(find.text(textos.qrMostrarAviso), findsOneWidget);
  });

  testWidgets('sin etiqueta, lo dice en vez de dejar un hueco', (tester) async {
    await _montar(
      tester,
      qr: QrGenerado(
        id: 'qr2',
        texto: 'AQ1.otro',
        venceAt: _qr.venceAt,
        etiqueta: null,
        puertas: _qr.puertas,
      ),
    );
    expect(find.text(textosEn(tester).qrSinEtiqueta), findsOneWidget);
  });

  testWidgets('cerrar sin compartir pide confirmación (S05)', (tester) async {
    await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.comunCerrar));
    await tester.pumpAndSettle();
    expect(find.text(textos.qrCerrarSinCompartirTitulo), findsOneWidget);

    await tester.tap(find.text(textos.qrCompartir).last);
    await tester.pumpAndSettle();
    expect(find.text('destino /qr'), findsNothing);

    await tester.tap(find.byTooltip(textos.comunCerrar));
    await tester.pumpAndSettle();
    await tester.tap(find.text(textos.qrCerrarIgual));
    await tester.pumpAndSettle();
    expect(find.text('destino /qr'), findsOneWidget);
  });

  testWidgets('compartir manda un PNG y después cerrar no pregunta', (
    tester,
  ) async {
    final compartir = await _montar(tester);
    final textos = textosEn(tester);

    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(FilledButton, textos.qrCompartir));
      await tester.pump();
      // La imagen se pinta fuera del árbol: hay que esperar al motor.
      for (var i = 0; i < 20 && compartir.enviados.isEmpty; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
    });
    await tester.pump();

    expect(compartir.enviados.single.nombreArchivo, 'qr-acceso.png');
    expect(compartir.enviados.single.texto, contains('Portón principal'));

    await tester.tap(find.byTooltip(textos.comunCerrar));
    await tester.pumpAndSettle();
    expect(find.text('destino /qr'), findsOneWidget);
  });

  group('distribución según la pantalla', () {
    testWidgets('en horizontal de teléfono (852×393) el QR entero queda a la '
        'izquierda sin taparlo', (tester) async {
      await _montar(tester, apaisada: true);
      final textos = textosEn(tester);
      final tokens = tester.element(find.byType(VisorQr)).tokens;

      final qr = tester.getRect(find.byType(VisorQr));
      final compartir = tester.getRect(
        find.widgetWithText(FilledButton, textos.qrCompartir),
      );
      final titulo = tester.getRect(find.text('Proveedor de gas'));

      // El QR completo: su lado de QR más la zona de silencio.
      expect(
        qr.height,
        tokens.tamano.qrMinimo + 2 * tokens.tamano.qrZonaSilencio,
      );
      expect(qr.top, greaterThanOrEqualTo(0));
      expect(qr.bottom, lessThanOrEqualTo(tamanoApaisado.height));
      expect(qr.right, lessThanOrEqualTo(titulo.left));
      // El botón queda a la derecha, alcanzable y sin tapar el QR.
      expect(compartir.overlaps(qr), isFalse);
      expect(compartir.left, greaterThanOrEqualTo(titulo.left));
      expect(compartir.bottom, lessThanOrEqualTo(tamanoApaisado.height));
    });

    testWidgets(
      'en vertical de teléfono (360×800) el QR va encima de los datos',
      (tester) async {
        await _montar(tester);
        final textos = textosEn(tester);

        final qr = tester.getRect(find.byType(VisorQr));
        final titulo = tester.getRect(find.text('Proveedor de gas'));
        final compartir = tester.getRect(
          find.widgetWithText(FilledButton, textos.qrCompartir),
        );
        expect(titulo.top, greaterThanOrEqualTo(qr.bottom));
        expect(compartir.top, greaterThanOrEqualTo(titulo.bottom));
      },
    );

    testWidgets('en vertical de teléfono (393×852) conserva la columna', (
      tester,
    ) async {
      await _montar(tester, tamano: const Size(393, 852));

      final qr = tester.getRect(find.byType(VisorQr));
      final titulo = tester.getRect(find.text('Proveedor de gas'));
      expect(titulo.top, greaterThanOrEqualTo(qr.bottom));
    });

    testWidgets('en tablet horizontal (800×600) conserva la columna', (
      tester,
    ) async {
      await _montar(tester, tamano: const Size(800, 600));

      final qr = tester.getRect(find.byType(VisorQr));
      final titulo = tester.getRect(find.text('Proveedor de gas'));
      expect(titulo.top, greaterThanOrEqualTo(qr.bottom));
    });
  });
}
