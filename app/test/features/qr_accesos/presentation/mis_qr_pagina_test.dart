import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

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

AppLocalizations _textos(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

Future<QrAccesosRepositorioFalso> _montar(
  WidgetTester tester, {
  required Pagina<QrAcceso> listado,
  Set<String> permisos = const {},
}) async {
  final repositorio = QrAccesosRepositorioFalso(listado: listado);
  await montarPantalla(
    tester,
    pagina: const MisQrPagina(),
    overrides: [
      qrAccesosRepositorioProvider.overrideWithValue(repositorio),
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

    expect(find.text(_textos(tester).qrSinEtiqueta), findsOneWidget);
  });

  testWidgets('elegir el filtro Usado pide esos QR', (tester) async {
    final repositorio = await _montar(tester, listado: _pagina(const []));
    final textos = _textos(tester);

    await tester.tap(find.widgetWithText(ChoiceChip, textos.qrEstadoUsado));
    await tester.pump();
    await tester.pump();

    expect(repositorio.estadosListados.last, EstadoQr.usado);
  });

  testWidgets('sin QR en el estado, lo dice con el estado vacío', (
    tester,
  ) async {
    await _montar(tester, listado: _pagina(const []));

    expect(find.text(_textos(tester).qrMisQrSinResultados), findsOneWidget);
  });

  testWidgets('sin el permiso de anular, un QR vigente no tiene el botón', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
    );

    expect(find.text(_textos(tester).qrAnular), findsNothing);
  });

  testWidgets('anular pide confirmación y, al confirmar, anula el QR', (
    tester,
  ) async {
    final repositorio = await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
      permisos: {Permisos.anularQr},
    );
    final textos = _textos(tester);

    await tester.tap(find.widgetWithText(FilledButton, textos.qrAnular));
    await tester.pumpAndSettle();
    expect(find.text(textos.qrAnularTitulo), findsOneWidget);

    await tester.tap(find.text(textos.qrAnularConfirmar));
    await tester.pumpAndSettle();

    expect(repositorio.anulados, ['qr1']);
  });

  testWidgets('cancelar la confirmación no anula nada', (tester) async {
    final repositorio = await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
      permisos: {Permisos.anularQr},
    );
    final textos = _textos(tester);

    await tester.tap(find.widgetWithText(FilledButton, textos.qrAnular));
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
      permisos: {Permisos.anularQr},
    );

    expect(find.text(_textos(tester).qrAnular), findsNothing);
  });

  testWidgets('sin el permiso de emitir, no ofrece emitir desde el listado', (
    tester,
  ) async {
    await _montar(tester, listado: _pagina(const []));
    expect(find.text(_textos(tester).qrMisQrNuevo), findsNothing);
  });

  testWidgets('con el permiso de emitir, ofrece emitir desde el listado', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina(const []),
      permisos: {Permisos.emitirQr},
    );
    expect(find.text(_textos(tester).qrMisQrNuevo), findsOneWidget);
  });
}
