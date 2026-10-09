import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

QrAcceso _qr({
  required String id,
  required EstadoQr estado,
  String? etiqueta,
}) => QrAcceso(
  id: id,
  etiqueta: etiqueta,
  estado: estado,
  venceAt: DateTime.utc(2026, 10, 9, 23, 59),
  usadoAt: null,
  anuladoAt: null,
  creadoAt: DateTime.utc(2026, 10, 9, 12),
  puertas: const [PuertaDeQr(id: 'p1', nombre: 'Portón principal')],
);

Pagina<QrAcceso> _pagina(List<QrAcceso> datos) =>
    Pagina(datos: datos, pagina: 1, porPagina: 20, total: datos.length);

Future<QrAccesosRepositorioFalso> _montar(
  WidgetTester tester, {
  required Pagina<QrAcceso> listado,
  Set<String> permisos = const {Permisos.verQr},
  bool expandida = false,
}) async {
  final repositorio = QrAccesosRepositorioFalso(
    listado: listado,
    resumen: {EstadoQr.vigente: listado.total, EstadoQr.usado: 27},
  );
  await montarPantalla(
    tester,
    pagina: const MisQrPagina(),
    expandida: expandida,
    overrides: [
      qrAccesosRepositorioProvider.overrideWithValue(repositorio),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repositorio;
}

void main() {
  testWidgets('lista los QR con su estado, etiqueta y puertas', (tester) async {
    await _montar(
      tester,
      listado: _pagina([
        _qr(id: 'qr1', estado: EstadoQr.vigente, etiqueta: 'Proveedor de gas'),
      ]),
    );

    expect(find.text('Proveedor de gas'), findsOneWidget);
    expect(find.text('Portón principal'), findsOneWidget);
    expect(find.byType(AccesoBadge), findsOneWidget);
  });

  testWidgets('sin etiqueta, muestra el texto de "sin etiqueta"', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
    );

    expect(find.text(textosEn(tester).qrSinEtiqueta), findsOneWidget);
  });

  testWidgets('elegir la pastilla Usados pide esos QR', (tester) async {
    final repositorio = await _montar(tester, listado: _pagina(const []));
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.qrFiltroUsados));
    await tester.pump();
    await tester.pump();

    expect(repositorio.estadosListados.last, EstadoQr.usado);
  });

  testWidgets('sin QR vigentes, lo dice con el estado vacío', (tester) async {
    await _montar(tester, listado: _pagina(const []));

    expect(find.text(textosEn(tester).qrMisQrSinVigentes), findsOneWidget);
  });

  testWidgets('sin el permiso de anular, un QR vigente no tiene el botón', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
    );

    expect(find.text(textosEn(tester).qrAnular), findsNothing);
  });

  testWidgets('anular muestra Vigente → Anulado y, al confirmar, anula', (
    tester,
  ) async {
    final repositorio = await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
      permisos: {Permisos.verQr, Permisos.anularQr},
    );
    final textos = textosEn(tester);

    await tester.tap(find.widgetWithText(TextButton, textos.qrAnular));
    await tester.pumpAndSettle();
    expect(find.text(textos.qrAnularTitulo), findsOneWidget);
    expect(find.text(textos.qrEstadoAnulado), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, textos.qrAnular));
    await tester.pumpAndSettle();

    expect(repositorio.anulados, ['qr1']);
  });

  testWidgets('cancelar la confirmación no anula nada', (tester) async {
    final repositorio = await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
      permisos: {Permisos.verQr, Permisos.anularQr},
    );
    final textos = textosEn(tester);

    await tester.tap(find.widgetWithText(TextButton, textos.qrAnular));
    await tester.pumpAndSettle();
    await tester.tap(find.text(textos.comunCancelar));
    await tester.pumpAndSettle();

    expect(repositorio.anulados, isEmpty);
  });

  testWidgets('un QR usado no ofrece anular aunque tenga el permiso', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.usado)]),
      permisos: {Permisos.verQr, Permisos.anularQr},
    );

    expect(find.text(textosEn(tester).qrAnular), findsNothing);
  });

  testWidgets('sin el permiso de emitir, no hay botón flotante', (
    tester,
  ) async {
    await _montar(tester, listado: _pagina(const []));
    expect(find.byType(FloatingActionButton), findsNothing);
  });

  testWidgets('con el permiso de emitir, el botón flotante lleva a emitir', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina(const []),
      permisos: {Permisos.verQr, Permisos.emitirQr},
    );
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    expect(find.text('destino /qr/nuevo'), findsOneWidget);
  });

  testWidgets('en expandido es una tabla con conteos en las pastillas', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina([
        _qr(id: 'qr1', estado: EstadoQr.vigente, etiqueta: 'Proveedor de gas'),
      ]),
      expandida: true,
    );
    final textos = textosEn(tester);

    expect(find.byType(DataTable), findsOneWidget);
    expect(find.text(textos.qrColumnaEtiqueta), findsOneWidget);
    expect(find.text('27'), findsOneWidget);
    expect(find.text(textos.comunRangoDe(1, 1, 1)), findsOneWidget);
  });
}
