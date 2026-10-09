import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/emitir_qr_pagina.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

final _emitido = QrEmitido(
  id: 'qr1',
  texto: 'AQ1.token',
  venceAt: DateTime.utc(2026, 10, 9, 23, 59),
  etiqueta: null,
  puertas: const [PuertaDeQr(id: 'p1', nombre: 'Portón')],
);

const _puertas = [
  Puerta(id: 'p1', nombre: 'Portón principal', sitioNombre: 'Sede'),
  Puerta(id: 'p2', nombre: 'Depósito', sitioNombre: 'Bodega'),
];

AppLocalizations _textos(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

Future<QrAccesosRepositorioFalso> _montar(
  WidgetTester tester, {
  List<Puerta> puertas = _puertas,
}) async {
  final repositorio = QrAccesosRepositorioFalso(emitido: _emitido);
  await montarPantalla(
    tester,
    pagina: const EmitirQrPagina(),
    overrides: [
      qrAccesosRepositorioProvider.overrideWithValue(repositorio),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(puertas),
      ),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repositorio;
}

void main() {
  testWidgets('lista las puertas de la cuenta para elegir una o varias', (
    tester,
  ) async {
    await _montar(tester);

    expect(find.text('Portón principal'), findsOneWidget);
    expect(find.text('Depósito'), findsOneWidget);
    expect(find.byType(CheckboxListTile), findsNWidgets(2));
  });

  testWidgets('sin puertas, explica que hace falta registrar una', (
    tester,
  ) async {
    await _montar(tester, puertas: const []);
    final textos = _textos(tester);

    expect(find.text(textos.qrEmitirSinPuertas), findsOneWidget);
  });

  testWidgets('emitir sin puertas marca el error y no llama a la API', (
    tester,
  ) async {
    final repositorio = await _montar(tester);
    final textos = _textos(tester);

    await tester.tap(find.widgetWithText(FilledButton, textos.qrEmitirBoton));
    await tester.pump();

    expect(find.text(textos.qrEmitirErrorSinPuertas), findsOneWidget);
    expect(repositorio.emisiones, isEmpty);
  });

  testWidgets('emitir con una puerta y una hora la envía y muestra el QR', (
    tester,
  ) async {
    final repositorio = await _montar(tester);
    final textos = _textos(tester);

    await tester.tap(find.text('Portón principal'));
    await tester.pump();
    await tester.tap(find.text(textos.qrVigenciaUnaHora));
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, textos.qrEmitirBoton));
    await tester.pump();
    await tester.pump();

    expect(repositorio.emisiones.single.puertaIds, ['p1']);
    expect(repositorio.emisiones.single.vigencia, OpcionVigencia.unaHora);
    // Tras emitir, la pantalla del QR recibe el token en `extra`.
    expect(find.text('destino /qr/emitido'), findsOneWidget);
  });

  testWidgets('la etiqueta de más de 60 caracteres se marca en el campo', (
    tester,
  ) async {
    final repositorio = await _montar(tester);
    final textos = _textos(tester);

    await tester.tap(find.text('Depósito'));
    await tester.enterText(find.byType(TextField), 'a' * 61);
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, textos.qrEmitirBoton));
    await tester.pump();

    expect(find.text(textos.qrEmitirErrorEtiquetaLarga), findsOneWidget);
    expect(repositorio.emisiones, isEmpty);
  });
}
