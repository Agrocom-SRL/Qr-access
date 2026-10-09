import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mostrar_qr_pagina.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/pantalla.dart';

final _qr = QrEmitido(
  id: 'qr1',
  texto: 'AQ1.token-de-prueba',
  venceAt: DateTime.utc(2026, 10, 9, 23, 59),
  etiqueta: 'Proveedor de gas',
  puertas: const [
    PuertaDeQr(id: 'p1', nombre: 'Portón principal'),
    PuertaDeQr(id: 'p2', nombre: 'Depósito'),
  ],
);

AppLocalizations _textos(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

void main() {
  testWidgets('muestra el QR con su etiqueta, puertas y hora de vencimiento', (
    tester,
  ) async {
    await montarPantalla(tester, pagina: MostrarQrPagina(qr: _qr));
    await tester.pump();
    final textos = _textos(tester);

    expect(find.bySemanticsLabel(textos.qrVisorEtiqueta), findsOneWidget);
    expect(find.text('Proveedor de gas'), findsOneWidget);
    expect(find.text('Portón principal, Depósito'), findsOneWidget);
    expect(
      find.text(textos.qrVenceEl(formatearFechaHora(_qr.venceAt))),
      findsOneWidget,
    );
  });

  testWidgets('sin etiqueta, lo dice en vez de dejar un hueco', (tester) async {
    final sinEtiqueta = QrEmitido(
      id: 'qr2',
      texto: 'AQ1.otro',
      venceAt: _qr.venceAt,
      etiqueta: null,
      puertas: _qr.puertas,
    );
    await montarPantalla(tester, pagina: MostrarQrPagina(qr: sinEtiqueta));
    await tester.pump();

    expect(find.text(_textos(tester).qrSinEtiqueta), findsOneWidget);
  });

  testWidgets('el aviso dice que sirve una sola vez', (tester) async {
    await montarPantalla(tester, pagina: MostrarQrPagina(qr: _qr));
    await tester.pump();

    expect(find.text(_textos(tester).qrMostrarAviso), findsOneWidget);
  });

  testWidgets('Listo vuelve al listado de QR', (tester) async {
    await montarPantalla(tester, pagina: MostrarQrPagina(qr: _qr));
    await tester.pump();

    await tester.tap(find.text(_textos(tester).qrListo));
    await tester.pumpAndSettle();

    expect(find.text('destino /qr'), findsOneWidget);
  });

  testWidgets('ofrece compartir la imagen', (tester) async {
    await montarPantalla(tester, pagina: MostrarQrPagina(qr: _qr));
    await tester.pump();

    expect(find.text(_textos(tester).qrCompartir), findsOneWidget);
  });
}
