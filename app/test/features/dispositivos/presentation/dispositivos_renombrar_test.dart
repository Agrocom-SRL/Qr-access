import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/dispositivos/data/sesiones_repositorio.dart';
import 'package:agrocom_acceso/features/dispositivos/dispositivos.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';
import '../../../helpers/sesiones_falsas.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

final _sesiones = [
  SesionConectada(
    id: 's1',
    plataforma: 'web',
    dispositivo: 'Notebook de Ana',
    ultimaActividadAt: _ahora,
    actual: true,
  ),
  SesionConectada(
    id: 's2',
    plataforma: 'ios',
    dispositivo: null,
    ultimaActividadAt: _ahora.subtract(const Duration(hours: 3)),
    actual: false,
  ),
];

Future<SesionesRepositorioFalso> _montar(
  WidgetTester tester, {
  Exception? errorRenombrar,
}) async {
  final repo = SesionesRepositorioFalso(
    sesiones: _sesiones,
    errorRenombrar: errorRenombrar,
  );
  await montarPantalla(
    tester,
    pagina: const DispositivosPagina(),
    overrides: [
      sesionControladorProvider.overrideWith(() => SesionFalsa(sesionCon())),
      sesionesRepositorioProvider.overrideWithValue(repo),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repo;
}

/// Lleva la acción de nombrar a la vista (la lista se desplaza) y la pulsa.
Future<void> _abrirRenombrar(WidgetTester tester) async {
  final boton = find.byTooltip(textosEn(tester).dispositivosRenombrar);
  await tester.ensureVisible(boton);
  await tester.tap(boton);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('solo este dispositivo se puede nombrar; los demás no', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    // Una sola acción de nombrar: la del aparato actual.
    expect(find.byTooltip(textos.dispositivosRenombrar), findsOneWidget);
  });

  testWidgets('nombrar guarda el nombre nuevo y lo confirma', (tester) async {
    final repo = await _montar(tester);
    final textos = textosEn(tester);

    await _abrirRenombrar(tester);
    await tester.pumpAndSettle();
    expect(find.text(textos.dispositivosRenombrarTitulo), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Laptop de oficina');
    await tester.tap(find.text(textos.comunGuardar));
    await tester.pumpAndSettle();

    expect(repo.nombresPedidos, ['Laptop de oficina']);
    expect(find.text(textos.dispositivosRenombrado), findsOneWidget);
  });

  testWidgets('un nombre vacío no se manda y el diálogo lo dice', (
    tester,
  ) async {
    final repo = await _montar(tester);
    final textos = textosEn(tester);

    await _abrirRenombrar(tester);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '   ');
    await tester.tap(find.text(textos.comunGuardar));
    await tester.pumpAndSettle();

    expect(repo.nombresPedidos, isEmpty);
    expect(find.text(textos.dispositivosRenombrarVacio), findsOneWidget);
  });

  testWidgets('cancelar no llama a la API', (tester) async {
    final repo = await _montar(tester);
    final textos = textosEn(tester);

    await _abrirRenombrar(tester);
    await tester.pumpAndSettle();
    await tester.tap(find.text(textos.comunCancelar));
    await tester.pumpAndSettle();

    expect(repo.nombresPedidos, isEmpty);
  });

  testWidgets('si la API no puede guardarlo, se traduce por su código', (
    tester,
  ) async {
    await _montar(
      tester,
      errorRenombrar: const ErrorApi(code: 'sesion.no_encontrada'),
    );
    final textos = textosEn(tester);

    await _abrirRenombrar(tester);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Tablet');
    await tester.tap(find.text(textos.comunGuardar));
    await tester.pumpAndSettle();

    expect(find.text(textos.comunErrorSesionNoEncontrada), findsOneWidget);
    expect(find.byType(SnackBar), findsOneWidget);
  });
}
