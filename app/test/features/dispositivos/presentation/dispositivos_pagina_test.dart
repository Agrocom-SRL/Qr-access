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
    dispositivo: 'iPhone de Ana',
    ultimaActividadAt: _ahora.subtract(const Duration(hours: 3)),
    actual: false,
  ),
  SesionConectada(
    id: 's3',
    plataforma: 'android',
    dispositivo: null,
    ultimaActividadAt: _ahora.subtract(const Duration(days: 2)),
    actual: false,
  ),
];

Future<SesionesRepositorioFalso> _montar(
  WidgetTester tester, {
  List<SesionConectada> sesiones = const [],
  SesionesRepositorioFalso? repositorio,
  bool expandida = false,
}) async {
  final repo = repositorio ?? SesionesRepositorioFalso(sesiones: sesiones);
  await montarPantalla(
    tester,
    pagina: const DispositivosPagina(),
    expandida: expandida,
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

/// Lleva el dedo a un control que puede estar debajo del pliegue de 800 px.
Future<void> _tocar(WidgetTester tester, Finder control) async {
  await tester.ensureVisible(control);
  await tester.tap(control);
}

/// El botón que confirma dentro del diálogo (el mismo texto que el de la fila).
Finder _confirmar(String texto) => find.widgetWithText(FilledButton, texto);

void main() {
  testWidgets('muestra cada aparato y marca el de este dispositivo', (
    tester,
  ) async {
    await _montar(tester, sesiones: _sesiones);
    final textos = textosEn(tester);

    expect(find.text('Notebook de Ana'), findsOneWidget);
    expect(find.text('iPhone de Ana'), findsOneWidget);
    expect(find.text(textos.dispositivosSinNombre), findsOneWidget);
    expect(find.text(textos.dispositivosEsteAparato), findsOneWidget);
    // La plataforma va en la misma línea que la última actividad.
    expect(
      find.textContaining(textos.dispositivosPlataformaWeb),
      findsOneWidget,
    );
  });

  testWidgets('la sesión de este aparato no ofrece cerrarla', (tester) async {
    await _montar(tester, sesiones: _sesiones);
    final textos = textosEn(tester);

    // Solo las dos demás tienen el botón de cerrar.
    expect(find.text(textos.dispositivosCerrarUna), findsNWidgets(2));
  });

  testWidgets('cerrar las demás solo se ofrece si hay otras sesiones', (
    tester,
  ) async {
    await _montar(tester, sesiones: [_sesiones.first]);
    expect(
      find.byTooltip(textosEn(tester).dispositivosCerrarTodas),
      findsNothing,
    );
  });

  testWidgets('cerrar una sesión pide confirmación y luego la cierra', (
    tester,
  ) async {
    final repo = await _montar(tester, sesiones: _sesiones);
    final textos = textosEn(tester);

    await _tocar(tester, find.text(textos.dispositivosCerrarUna).first);
    await tester.pumpAndSettle();
    expect(find.text(textos.dispositivosCerrarUnaTitulo), findsOneWidget);
    expect(find.text(textos.dispositivosCerrarUnaMensaje), findsOneWidget);

    await tester.tap(_confirmar(textos.dispositivosCerrarUnaConfirmar));
    await tester.pumpAndSettle();

    expect(repo.cerradas, ['s2']);
    expect(find.text(textos.dispositivosCerradaUna), findsOneWidget);
  });

  testWidgets('si no confirma, no se cierra nada', (tester) async {
    final repo = await _montar(tester, sesiones: _sesiones);
    final textos = textosEn(tester);

    await _tocar(tester, find.text(textos.dispositivosCerrarUna).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text(textos.comunCancelar));
    await tester.pumpAndSettle();

    expect(repo.cerradas, isEmpty);
  });

  testWidgets('cerrar las demás avisa lo que pasa con los QR y cuántas cerró', (
    tester,
  ) async {
    final repo = await _montar(
      tester,
      sesiones: _sesiones,
      repositorio: SesionesRepositorioFalso(
        sesiones: _sesiones,
        cerradasDeOtras: 2,
      ),
    );
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.dispositivosCerrarTodas));
    await tester.pumpAndSettle();
    expect(find.text(textos.dispositivosCerrarTodasTitulo), findsOneWidget);
    expect(find.text(textos.dispositivosCerrarTodasMensaje), findsOneWidget);

    await tester.tap(_confirmar(textos.dispositivosCerrarTodasConfirmar));
    await tester.pumpAndSettle();

    expect(repo.pedidosDeCerrarOtras, 1);
    expect(find.text(textos.dispositivosCerradas(2)), findsOneWidget);
  });

  testWidgets('un error al cerrar se traduce por su código', (tester) async {
    await _montar(
      tester,
      repositorio: SesionesRepositorioFalso(
        sesiones: _sesiones,
        errorCerrar: const ErrorApi(code: 'sesion.no_encontrada', status: 404),
      ),
    );
    final textos = textosEn(tester);

    await _tocar(tester, find.text(textos.dispositivosCerrarUna).first);
    await tester.pumpAndSettle();
    await tester.tap(_confirmar(textos.dispositivosCerrarUnaConfirmar));
    await tester.pumpAndSettle();

    expect(find.text(textos.comunErrorSesionNoEncontrada), findsOneWidget);
  });

  testWidgets('sin conexión al cargar, lo dice con su título', (tester) async {
    await _montar(
      tester,
      repositorio: SesionesRepositorioFalso(
        errorListar: const ErrorApi(code: 'red.sin_conexion'),
      ),
    );

    expect(find.text(textosEn(tester).dispositivosErrorCargar), findsOneWidget);
  });

  testWidgets('en expandido, la lista es una tabla con sus acciones', (
    tester,
  ) async {
    await _montar(tester, sesiones: _sesiones, expandida: true);
    final textos = textosEn(tester);

    expect(find.text(textos.dispositivosColumnaDispositivo), findsOneWidget);
    expect(find.text(textos.dispositivosColumnaActividad), findsOneWidget);
    // Un botón de cerrar por cada sesión que no es la de este aparato.
    expect(find.byTooltip(textos.dispositivosCerrarUna), findsNWidgets(2));
  });
}
