import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/presentation/ingreso_pagina.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const _inicio = RespuestaInicio(
  acceso: 'acc',
  refresco: 'ref',
  usuario: usuarioDePrueba,
  cuenta: cuentaDePrueba,
  roles: [RolSesion(id: 'r1', nombre: 'Usuario')],
  rolActivoId: 'r1',
);

Finder get _campoPin => find.byType(TextField);

Finder _botonIngresar(WidgetTester tester) =>
    find.widgetWithText(FilledButton, textosEn(tester).sesionBotonIngresar);

bool _habilitado(WidgetTester tester) =>
    tester.widget<FilledButton>(_botonIngresar(tester)).enabled;

/// Monta el ingreso con sus dependencias falsas y devuelve las que el test
/// mira.
Future<({SesionRepositorioFalso repositorio, SesionFalsa sesion})> _montar(
  WidgetTester tester, {
  SesionRepositorioFalso? repositorio,
  ThemeData? tema,
  bool expandida = false,
}) async {
  final repo = repositorio ?? SesionRepositorioFalso(respuesta: _inicio);
  final sesion = SesionFalsa();
  await montarPantalla(
    tester,
    pagina: const IngresoPagina(),
    tema: tema,
    expandida: expandida,
    overrides: [
      sesionRepositorioProvider.overrideWithValue(repo),
      sesionControladorProvider.overrideWith(() => sesion),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  return (repositorio: repo, sesion: sesion);
}

void main() {
  for (final (nombre, tema) in [
    ('claro', Tema.claro),
    ('oscuro', Tema.oscuro),
  ]) {
    testWidgets(
      'muestra título, casillas y botón deshabilitado (tema $nombre)',
      (tester) async {
        await _montar(tester, tema: tema);
        final textos = textosEn(tester);

        expect(find.text(textos.sesionIngresoTitulo), findsOneWidget);
        expect(find.text(textos.sesionPinLeyenda), findsOneWidget);
        expect(find.bySemanticsLabel(textos.sesionCampoPin), findsOneWidget);
        expect(_habilitado(tester), isFalse);
      },
    );
  }

  testWidgets('el PIN se escribe en mayúsculas, sin espacios ni guiones', (
    tester,
  ) async {
    await _montar(tester);

    await tester.enterText(_campoPin, 'agr-7k2q');
    await tester.pump();

    expect(tester.widget<TextField>(_campoPin).controller?.text, 'AGR7K2Q');
    expect(find.text('Q'), findsOneWidget);
    expect(_habilitado(tester), isTrue);
  });

  testWidgets('Ocultar reemplaza los caracteres por puntos', (tester) async {
    await _montar(tester);
    final textos = textosEn(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(find.text(textos.sesionOcultarPin));
    await tester.pump();

    expect(find.text('Q'), findsNothing);
    expect(find.text('•'), findsNWidgets(7));
    expect(find.text(textos.sesionMostrarPin), findsOneWidget);
  });

  testWidgets('con menos de 7 caracteres, Ingresar sigue deshabilitado', (
    tester,
  ) async {
    final (:repositorio, sesion: _) = await _montar(tester);

    await tester.enterText(_campoPin, 'AGR7K');
    await tester.pump();

    expect(_habilitado(tester), isFalse);
    expect(repositorio.pinesRecibidos, isEmpty);
  });

  testWidgets('un PIN válido inicia la sesión con la respuesta de la API', (
    tester,
  ) async {
    final (:repositorio, :sesion) = await _montar(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(_botonIngresar(tester));
    await tester.pump();
    await tester.pump();

    expect(repositorio.pinesRecibidos.single.valor, 'AGR7K2Q');
    expect(sesion.inicios.single, _inicio);
  });

  testWidgets('un PIN rechazado muestra "PIN incorrecto"', (tester) async {
    await _montar(
      tester,
      repositorio: SesionRepositorioFalso(
        error: const ErrorApi(
          code: 'sesion.credenciales_invalidas',
          status: 401,
        ),
      ),
    );
    final textos = textosEn(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(_botonIngresar(tester));
    await tester.pump();
    await tester.pump();

    expect(
      find.text(textos.comunErrorSesionCredencialesInvalidas),
      findsOneWidget,
    );
  });

  testWidgets('el bloqueo muestra la cuenta regresiva y deshabilita todo', (
    tester,
  ) async {
    await _montar(
      tester,
      repositorio: SesionRepositorioFalso(
        error: const ErrorApi(
          code: 'sesion.bloqueada',
          status: 429,
          detalles: {'reintentar_en_segundos': 292},
        ),
      ),
    );
    final textos = textosEn(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(_botonIngresar(tester));
    await tester.pump();
    await tester.pump();

    expect(find.text(textos.comunErrorSesionBloqueada), findsOneWidget);
    expect(find.text('04:52'), findsOneWidget);
    expect(_habilitado(tester), isFalse);
    expect(tester.widget<TextField>(_campoPin).enabled, isFalse);
  });

  testWidgets('la flecha vuelve a la bienvenida', (tester) async {
    await _montar(tester);
    await tester.tap(find.byTooltip(textosEn(tester).comunVolver));
    await tester.pumpAndSettle();
    expect(find.text('destino /bienvenida'), findsOneWidget);
  });

  testWidgets('en expandido muestra el panel de marca', (tester) async {
    await _montar(tester, expandida: true);
    expect(find.text(textosEn(tester).bienvenidaFrase), findsOneWidget);
  });
}
