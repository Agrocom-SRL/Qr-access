import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/emitir_qr_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/indicador_pasos.dart';
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
  Puerta(
    id: 'p1',
    nombre: 'Portón principal',
    sitioId: 's1',
    sitioNombre: 'Sede',
    dispositivo: DispositivoDePuerta(
      id: 'd1',
      nombre: 'LECT-1',
      enLinea: true,
      ultimoLatidoAt: null,
    ),
  ),
  Puerta(id: 'p2', nombre: 'Depósito', sitioId: 's2', sitioNombre: 'Bodega'),
];

Future<QrAccesosRepositorioFalso> _montar(
  WidgetTester tester, {
  List<Puerta> puertas = _puertas,
  bool expandida = false,
}) async {
  final repositorio = QrAccesosRepositorioFalso(emitido: _emitido);
  await montarPantalla(
    tester,
    pagina: const EmitirQrPagina(),
    expandida: expandida,
    overrides: [
      qrAccesosRepositorioProvider.overrideWithValue(repositorio),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(puertas),
      ),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.emitirQr})),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repositorio;
}

Finder _boton(String texto) => find.widgetWithText(FilledButton, texto);

void main() {
  testWidgets(
    'el paso 1 agrupa las puertas por sitio y marca las sin conexión',
    (tester) async {
      await _montar(tester);
      final textos = textosEn(tester);

      expect(find.byType(IndicadorPasos), findsOneWidget);
      expect(find.text('SEDE'), findsOneWidget);
      expect(find.text('BODEGA'), findsOneWidget);
      expect(find.text('Portón principal'), findsOneWidget);
      expect(find.text('Depósito'), findsOneWidget);
      expect(find.text(textos.puertaSinConexion), findsOneWidget);
    },
  );

  testWidgets('sin puertas, explica que hace falta pedirlas', (tester) async {
    await _montar(tester, puertas: const []);
    expect(find.text(textosEn(tester).qrEmitirSinPuertas), findsOneWidget);
  });

  testWidgets('Siguiente sin puertas marca el error y no avanza', (
    tester,
  ) async {
    final repositorio = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(_boton(textos.comunSiguiente));
    await tester.pump();

    expect(find.text(textos.qrEmitirErrorSinPuertas), findsOneWidget);
    expect(find.text(textos.qrEmitirPregunta), findsOneWidget);
    expect(repositorio.emisiones, isEmpty);
  });

  testWidgets('los tres pasos: puerta, 1 h y etiqueta, y emite', (
    tester,
  ) async {
    final repositorio = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.text('Portón principal'));
    await tester.pump();
    expect(find.text('1 ${textos.qrEmitirPuertasContadas(1)}'), findsOneWidget);
    await tester.tap(_boton(textos.comunSiguiente));
    await tester.pump();

    expect(find.text(textos.qrVigenciaFinDelDia), findsOneWidget);
    await tester.tap(find.text(textos.qrVigenciaUnaHora));
    await tester.pump();
    await tester.enterText(find.byType(TextField), ' Proveedor de gas ');
    await tester.pump();
    await tester.tap(_boton(textos.comunSiguiente));
    await tester.pump();

    expect(find.text(textos.qrEmitirRevisa), findsOneWidget);
    expect(find.text('Proveedor de gas'), findsOneWidget);
    await tester.tap(_boton(textos.qrEmitirBoton));
    await tester.pump();
    await tester.pump();

    final emision = repositorio.emisiones.single;
    expect(emision.puertaIds, ['p1']);
    expect(emision.vigencia.opcion, OpcionVigencia.unaHora);
    expect(emision.etiqueta, 'Proveedor de gas');
    // Tras emitir, la pantalla del QR recibe el token en `extra`.
    expect(find.text('destino /qr/emitido'), findsOneWidget);
  });

  testWidgets('"Todas" de un sitio marca sus puertas', (tester) async {
    await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.qrEmitirTodas).first);
    await tester.pump();

    expect(find.text('1 ${textos.qrEmitirPuertasContadas(1)}'), findsOneWidget);
  });

  testWidgets('la etiqueta se corta en 40 caracteres y muestra el contador', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.text('Depósito'));
    await tester.pump();
    await tester.tap(_boton(textos.comunSiguiente));
    await tester.pump();
    await tester.enterText(find.byType(TextField), 'a' * 41);
    await tester.pump();

    final campo = tester.widget<TextField>(find.byType(TextField));
    expect(campo.controller?.text.length, 40);
    expect(find.text('40/40'), findsOneWidget);
  });

  testWidgets('en expandido el resumen va fijo a la derecha', (tester) async {
    await _montar(tester, expandida: true);
    final textos = textosEn(tester);

    expect(find.text(textos.qrResumenTitulo), findsOneWidget);
    expect(find.text(textos.qrEmitirSeleccionarTodas), findsNWidgets(2));
  });
}
