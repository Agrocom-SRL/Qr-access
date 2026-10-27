import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_qr.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
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
  AlmacenQr? almacenQr,
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
      if (almacenQr != null) almacenQrProvider.overrideWithValue(almacenQr),
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
    await tester.pumpAndSettle();

    expect(repositorio.estadosListados.last, EstadoQr.usado);
  });

  testWidgets('sin QR vigentes, el estado vacío dice que no tienes vigentes', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina(const []),
      permisos: {Permisos.verQr, Permisos.generarQr},
    );
    final textos = textosEn(tester);

    expect(find.text(textos.qrVacioVigentesTitulo), findsOneWidget);
    expect(find.text(textos.qrVacioVigentesAyuda), findsOneWidget);
    expect(find.text(textos.qrVacioUsadosTitulo), findsNothing);
  });

  testWidgets('el estado vacío no lleva botón aunque pueda generar', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina(const []),
      permisos: {Permisos.verQr, Permisos.generarQr},
    );

    expect(find.byType(EstadoVacio), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(EstadoVacio),
        matching: find.byType(AccesoBoton),
      ),
      findsNothing,
    );
  });

  testWidgets('en expandido, cada filtro vacío dice su título y su ayuda', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina(const []),
      permisos: {Permisos.verQr, Permisos.generarQr},
      expandida: true,
    );
    final textos = textosEn(tester);

    final casos = <({String filtro, String titulo, String ayuda})>[
      (
        filtro: textos.qrFiltroUsados,
        titulo: textos.qrVacioUsadosTitulo,
        ayuda: textos.qrVacioUsadosAyuda,
      ),
      (
        filtro: textos.qrFiltroVencidos,
        titulo: textos.qrVacioVencidosTitulo,
        ayuda: textos.qrVacioVencidosAyuda,
      ),
      (
        filtro: textos.qrFiltroAnulados,
        titulo: textos.qrVacioAnuladosTitulo,
        ayuda: textos.qrVacioAnuladosAyuda,
      ),
      (
        filtro: textos.qrFiltroVigentes,
        titulo: textos.qrVacioVigentesTitulo,
        ayuda: textos.qrVacioVigentesAyuda,
      ),
    ];
    for (final caso in casos) {
      await tester.tap(find.text(caso.filtro));
      await tester.pumpAndSettle();

      expect(find.text(caso.titulo), findsOneWidget);
      expect(find.text(caso.ayuda), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(EstadoVacio),
          matching: find.byType(AccesoBoton),
        ),
        findsNothing,
      );
    }
  });

  testWidgets('en compacto, un filtro vacío muestra su propio título', (
    tester,
  ) async {
    await _montar(tester, listado: _pagina(const []));
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.qrFiltroAnulados));
    await tester.pumpAndSettle();

    expect(find.text(textos.qrVacioAnuladosTitulo), findsWidgets);
    expect(find.text(textos.qrVacioAnuladosAyuda), findsWidgets);
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

  testWidgets('sin el permiso de generar, no hay botón flotante', (
    tester,
  ) async {
    await _montar(tester, listado: _pagina(const []));
    expect(find.byType(FloatingActionButton), findsNothing);
  });

  testWidgets('con el permiso de generar, el botón flotante lleva a generar', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina(const []),
      permisos: {Permisos.verQr, Permisos.generarQr},
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

  testWidgets('"Atrás" en Mis QR vuelve al inicio en vez de salir', (
    tester,
  ) async {
    await _montar(tester, listado: _pagina(const []));

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('destino /inicio'), findsOneWidget);
  });

  testWidgets('un QR vigente generado en este dispositivo ofrece Ver QR', (
    tester,
  ) async {
    final almacen = AlmacenQrEnMemoria();
    await almacen.guardar('qr1', 'AQ1.abc', DateTime.utc(2099));
    await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr1', estado: EstadoQr.vigente)]),
      almacenQr: almacen,
    );
    final textos = textosEn(tester);

    expect(find.text(textos.qrVerQr), findsOneWidget);
    expect(find.text(textos.qrSoloEnOtroDispositivo), findsNothing);

    await tester.tap(find.text(textos.qrVerQr));
    await tester.pumpAndSettle();
    expect(find.text('destino /qr/generado'), findsOneWidget);
  });

  testWidgets('un QR vigente generado en otro dispositivo lo avisa', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina([_qr(id: 'qr2', estado: EstadoQr.vigente)]),
      almacenQr: AlmacenQrEnMemoria(),
    );
    final textos = textosEn(tester);

    expect(find.text(textos.qrVerQr), findsNothing);
    expect(find.text(textos.qrSoloEnOtroDispositivo), findsOneWidget);
  });

  testWidgets('en horizontal de teléfono (852x393) el vacío no desborda', (
    tester,
  ) async {
    await _montar(
      tester,
      listado: _pagina(const []),
      permisos: {Permisos.verQr, Permisos.generarQr},
    );
    // Horizontal de iPhone: ancho de clase media, poca altura.
    usarTamano(tester, const Size(852, 393));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(EstadoVacio), findsOneWidget);
    expect(find.text(textosEn(tester).qrVacioVigentesTitulo), findsOneWidget);
  });
}
