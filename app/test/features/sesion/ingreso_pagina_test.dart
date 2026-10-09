import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/presentation/ingreso_pagina.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

const _inicio = RespuestaInicio(
  acceso: 'acc',
  refresco: 'ref',
  usuario: UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
  cuenta: CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
  roles: [RolSesion(id: 'r1', nombre: 'Usuario')],
  rolActivoId: 'r1',
);

AppLocalizations _textos(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

Finder get _campoPin => find.byType(TextField);

Finder _botonIngresar(AppLocalizations textos) =>
    find.widgetWithText(FilledButton, textos.sesionBotonIngresar);

/// Monta el ingreso con sus dependencias falsas y devuelve las que el test
/// mira.
Future<({SesionRepositorioFalso repositorio, SesionFalsa sesion})> _montar(
  WidgetTester tester, {
  SesionRepositorioFalso? repositorio,
  ThemeData? tema,
}) async {
  final repo = repositorio ?? SesionRepositorioFalso(respuesta: _inicio);
  final sesion = SesionFalsa();
  await montarPantalla(
    tester,
    pagina: const IngresoPagina(),
    tema: tema,
    overrides: [
      sesionRepositorioProvider.overrideWithValue(repo),
      sesionControladorProvider.overrideWith(() => sesion),
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
    testWidgets('muestra título, campo del PIN y botón (tema $nombre)', (
      tester,
    ) async {
      await _montar(tester, tema: tema);
      final textos = _textos(tester);

      expect(find.text(textos.sesionIngresoTitulo), findsOneWidget);
      expect(find.text(textos.sesionCampoPin), findsOneWidget);
      expect(_botonIngresar(textos), findsOneWidget);
    });
  }

  testWidgets('el PIN se escribe en mayúsculas y sin espacios', (tester) async {
    await _montar(tester);

    await tester.enterText(_campoPin, 'agr 7k2q');
    await tester.pump();

    expect(tester.widget<TextField>(_campoPin).controller?.text, 'AGR7K2Q');
  });

  testWidgets('un PIN incompleto muestra el error y no sale del dispositivo', (
    tester,
  ) async {
    final (:repositorio, :sesion) = await _montar(tester);
    final textos = _textos(tester);

    await tester.enterText(_campoPin, 'AGR7K');
    await tester.tap(_botonIngresar(textos));
    await tester.pump();

    expect(find.text(textos.sesionPinFormatoInvalido), findsOneWidget);
    expect(repositorio.pinesRecibidos, isEmpty);
    expect(sesion.inicios, isEmpty);
  });

  testWidgets('un PIN válido inicia la sesión con la respuesta de la API', (
    tester,
  ) async {
    final (:repositorio, :sesion) = await _montar(tester);
    final textos = _textos(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.tap(_botonIngresar(textos));
    await tester.pump();
    await tester.pump();

    expect(repositorio.pinesRecibidos.single.valor, 'AGR7K2Q');
    expect(sesion.inicios.single, _inicio);
  });

  testWidgets('un PIN rechazado muestra el mensaje traducido del code', (
    tester,
  ) async {
    final repositorio = SesionRepositorioFalso(
      error: const ErrorApi(code: 'sesion.credenciales_invalidas', status: 401),
    );
    await _montar(tester, repositorio: repositorio);
    final textos = _textos(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.tap(_botonIngresar(textos));
    await tester.pump();
    await tester.pump();

    expect(
      find.text(textos.comunErrorSesionCredencialesInvalidas),
      findsOneWidget,
    );
  });
}
