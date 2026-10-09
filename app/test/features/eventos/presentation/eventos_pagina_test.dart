import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/eventos/data/eventos_repositorio.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/features/eventos/presentation/eventos_pagina.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

EventoAcceso _evento({
  required String id,
  required ResultadoEvento resultado,
  required String motivo,
}) => EventoAcceso(
  id: id,
  ocurridoAt: DateTime.utc(2026, 10, 9, 13),
  resultado: resultado,
  motivoCode: motivo,
  puertaNombre: 'Portón principal',
);

AppLocalizations _textos(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

Future<void> _montar(WidgetTester tester, List<EventoAcceso> eventos) async {
  await montarPantalla(
    tester,
    pagina: const EventosPagina(),
    overrides: [
      eventosRepositorioProvider.overrideWithValue(
        EventosRepositorioFalso(
          Pagina(
            datos: eventos,
            pagina: 1,
            porPagina: 20,
            total: eventos.length,
          ),
        ),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('muestra el resultado y el motivo traducido de cada intento', (
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
    final textos = _textos(tester);

    expect(find.text(textos.eventoResultadoRechazado), findsOneWidget);
    expect(find.text(textos.eventoMotivoQrVencido), findsOneWidget);
    expect(find.text(textos.eventoResultadoPermitido), findsOneWidget);
    expect(find.text(textos.eventoMotivoAccesoPermitido), findsOneWidget);
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

    expect(find.text(_textos(tester).eventoMotivoDesconocido), findsOneWidget);
  });

  testWidgets('sin eventos, lo dice con el estado vacío', (tester) async {
    await _montar(tester, const []);

    expect(find.text(_textos(tester).eventosSinResultados), findsOneWidget);
  });
}
