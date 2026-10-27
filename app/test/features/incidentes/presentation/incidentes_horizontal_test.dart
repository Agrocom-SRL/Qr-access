import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/incidentes.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/horizontal.dart';
import '../../../helpers/incidentes_falsos.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

Future<void> _montarLista(
  WidgetTester tester, {
  required IncidentesRepositorioFalso repositorio,
}) async {
  await montarPantalla(
    tester,
    pagina: const IncidentesPagina(),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.verIncidentes})),
      ),
      incidentesRepositorioProvider.overrideWithValue(repositorio),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
}

Future<void> _montarDetalle(
  WidgetTester tester, {
  required IncidentesRepositorioFalso repositorio,
  required String id,
}) async {
  await montarPantalla(
    tester,
    pagina: IncidenteDetallePagina(id: id),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(
          sesionCon(
            permisos: {Permisos.verIncidentes, Permisos.resolverIncidentes},
          ),
        ),
      ),
      incidentesRepositorioProvider.overrideWithValue(repositorio),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets(
    'la lista de incidentes en horizontal se desplaza sin desbordar',
    (tester) async {
      await _montarLista(
        tester,
        repositorio: IncidentesRepositorioFalso(
          incidentes: [
            incidenteDePrueba(),
            incidenteDePrueba(id: '8'),
          ],
        ),
      );
      usarHorizontal(tester);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Jorge'), findsWidgets);
    },
  );

  testWidgets('sin incidentes, la lista en horizontal muestra su ilustración', (
    tester,
  ) async {
    await _montarLista(tester, repositorio: IncidentesRepositorioFalso());
    usarHorizontal(tester);
    await tester.pumpAndSettle();
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(textos.incidentesVacioTitulo), findsOneWidget);
    expect(find.text(textos.incidentesVacioAyuda), findsOneWidget);
  });

  testWidgets('el detalle en horizontal se desplaza sin desbordar', (
    tester,
  ) async {
    await _montarDetalle(
      tester,
      repositorio: IncidentesRepositorioFalso(
        incidentes: [incidenteDePrueba()],
        detalle: incidenteDePrueba(descripcion: 'Entró dos veces seguidas'),
      ),
      id: '7',
    );
    usarHorizontal(tester);
    await tester.pumpAndSettle();
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(textos.incidenteResolverGuardar), findsOneWidget);
  });
}
