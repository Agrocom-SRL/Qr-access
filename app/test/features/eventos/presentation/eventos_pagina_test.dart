import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/eventos/data/eventos_repositorio.dart';
import 'package:agrocom_acceso/features/eventos/domain/lectura.dart';
import 'package:agrocom_acceso/features/eventos/presentation/eventos_pagina.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

Lectura _evento({
  required String id,
  required ResultadoEvento resultado,
  required String motivo,
  DateTime? ocurridoAt,
}) => Lectura(
  id: id,
  ocurridoAt: ocurridoAt ?? DateTime.utc(2026, 10, 9, 13),
  resultado: resultado,
  motivoCode: motivo,
  puertaNombre: 'Portón principal',
  sitioNombre: 'Sede',
  qrEtiqueta: 'Proveedor de gas',
  generadorEtiqueta: 'Jorge R.',
);

Future<EventosRepositorioFalso> _montar(
  WidgetTester tester,
  List<Lectura> eventos, {
  Exception? error,
  bool expandida = false,
}) async {
  final repositorio = EventosRepositorioFalso(
    Pagina(datos: eventos, pagina: 1, porPagina: 20, total: eventos.length),
    error: error,
  );
  await montarPantalla(
    tester,
    pagina: const EventosPagina(),
    expandida: expandida,
    overrides: [
      eventosRepositorioProvider.overrideWithValue(repositorio),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(const [
          Puerta(
            id: 'p1',
            nombre: 'Portón principal',
            sitioId: 's1',
            sitioNombre: 'Sede',
          ),
        ]),
      ),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.verEventos})),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repositorio;
}

void main() {
  testWidgets('muestra el resultado, el motivo corto y el QR de cada intento', (
    tester,
  ) async {
    await _montar(tester, [
      _evento(
        id: 'e1',
        resultado: ResultadoEvento.rechazado,
        motivo: 'qr.vencido',
      ),
      _evento(
        id: 'e2',
        resultado: ResultadoEvento.permitido,
        motivo: 'acceso.permitido',
      ),
    ]);
    final textos = textosEn(tester);

    expect(find.text(textos.lecturaResultadoRechazado), findsOneWidget);
    expect(find.text(textos.lecturaMotivoQrVencido), findsOneWidget);
    expect(find.text(textos.lecturaResultadoPermitido), findsOneWidget);
    expect(
      find.text(textos.lecturaQrDe('Proveedor de gas', 'Jorge R.')),
      findsOneWidget,
    );
    expect(find.text('Portón principal'), findsNWidgets(2));
  });

  testWidgets('un motivo que la app no conoce muestra el genérico', (
    tester,
  ) async {
    await _montar(tester, [
      _evento(
        id: 'e1',
        resultado: ResultadoEvento.rechazado,
        motivo: 'algo.nuevo',
      ),
    ]);

    expect(
      find.text(textosEn(tester).lecturaMotivoDesconocido),
      findsOneWidget,
    );
  });

  testWidgets('sin eventos, lo dice con el estado vacío', (tester) async {
    await _montar(tester, const []);

    expect(find.text(textosEn(tester).lecturasSinResultados), findsOneWidget);
  });

  testWidgets('la pastilla Rechazados filtra por resultado', (tester) async {
    final repositorio = await _montar(tester, const []);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.lecturasFiltroRechazados));
    await tester.pumpAndSettle();

    expect(
      repositorio.filtrosPedidos.last.resultado,
      ResultadoEvento.rechazado,
    );
    expect(find.text(textos.lecturasSinResultadosFiltro), findsOneWidget);
  });

  testWidgets('sin red, ofrece reintentar', (tester) async {
    await _montar(
      tester,
      const [],
      error: const ErrorApi(code: ErrorApi.sinConexion),
    );
    final textos = textosEn(tester);

    expect(find.text(textos.lecturasErrorCargar), findsOneWidget);
    expect(find.text(textos.comunReintentar), findsOneWidget);
  });

  testWidgets('en expandido es una tabla con hora, sitio y motivo', (
    tester,
  ) async {
    await _montar(tester, [
      _evento(
        id: 'e1',
        resultado: ResultadoEvento.rechazado,
        motivo: 'qr.usado',
      ),
    ], expandida: true);
    final textos = textosEn(tester);

    expect(find.byType(DataTable), findsOneWidget);
    expect(find.text(textos.lecturasColumnaSitio), findsOneWidget);
    expect(find.text('Sede'), findsOneWidget);
    expect(find.text(textos.lecturaMotivoQrUsado), findsOneWidget);
  });
}
