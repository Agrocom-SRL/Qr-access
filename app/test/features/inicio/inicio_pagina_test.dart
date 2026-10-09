import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/inicio/inicio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

AppLocalizations _textos(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

Future<SesionFalsa> _montar(
  WidgetTester tester, {
  Set<String> permisos = const {},
}) async {
  final sesion = SesionFalsa(sesionCon(permisos: permisos));
  await montarPantalla(
    tester,
    pagina: const InicioPagina(),
    overrides: [sesionControladorProvider.overrideWith(() => sesion)],
  );
  await tester.pump();
  return sesion;
}

void main() {
  testWidgets('muestra solo las funciones que el rol activo puede usar', (
    tester,
  ) async {
    await _montar(tester, permisos: {Permisos.emitirQr, Permisos.verEventos});
    final textos = _textos(tester);

    expect(find.text(textos.inicioEmitirQr), findsOneWidget);
    expect(find.text(textos.inicioEventos), findsOneWidget);
    expect(find.text(textos.inicioMisQr), findsNothing);
  });

  testWidgets('sin permisos de la app, muestra el estado vacío', (
    tester,
  ) async {
    await _montar(tester);
    final textos = _textos(tester);

    expect(find.text(textos.inicioSinAccesos), findsOneWidget);
    expect(find.text(textos.inicioEmitirQr), findsNothing);
  });

  testWidgets('una función abre su pantalla', (tester) async {
    await _montar(tester, permisos: {Permisos.emitirQr});
    final textos = _textos(tester);

    await tester.tap(find.text(textos.inicioEmitirQr));
    await tester.pumpAndSettle();

    expect(find.text('destino /qr/nuevo'), findsOneWidget);
  });

  testWidgets('cerrar sesión desde el tablero llama al controlador', (
    tester,
  ) async {
    final sesion = await _montar(tester, permisos: {Permisos.emitirQr});
    final textos = _textos(tester);

    await tester.tap(find.byTooltip(textos.sesionCerrar));
    await tester.pump();

    expect(sesion.cierres, 1);
  });
}
