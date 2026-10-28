import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:agrocom_acceso/features/incidentes/incidentes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/incidentes_falsos.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

const Set<String> _resuelve = {
  Permisos.verIncidentes,
  Permisos.resolverIncidentes,
};

Future<IncidentesRepositorioFalso> _montar(
  WidgetTester tester, {
  required Incidente incidente,
  Set<String> permisos = _resuelve,
  IncidentesRepositorioFalso? repositorio,
}) async {
  final repo =
      repositorio ?? IncidentesRepositorioFalso(incidentes: [incidente]);
  await montarPantalla(
    tester,
    pagina: IncidenteDetallePagina(id: incidente.id),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      incidentesRepositorioProvider.overrideWithValue(repo),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repo;
}

/// Lleva el dedo a un control que puede estar debajo del pliegue: la página
/// se desplaza, como en los demás tests de pantalla.
Future<void> _tocar(WidgetTester tester, Finder control) async {
  await tester.ensureVisible(control);
  await tester.tap(control);
}

/// Elige la decisión "Confirmar" del selector (el único texto así antes de
/// abrir el diálogo) y escribe el motivo.
Future<void> _confirmarEnFormulario(WidgetTester tester, String motivo) async {
  final textos = textosEn(tester);
  await _tocar(tester, find.text(textos.incidenteResolverConfirmar));
  await tester.pump();
  await tester.enterText(find.byType(TextField), motivo);
  await tester.pump();
}

void main() {
  testWidgets('con permiso y de otra persona, ofrece la decisión', (
    tester,
  ) async {
    await _montar(tester, incidente: incidenteDePrueba());
    final textos = textosEn(tester);

    expect(find.text(textos.incidenteResolverGuardar), findsOneWidget);
    expect(find.text(textos.incidenteDetalleSoloLectura), findsNothing);
  });

  testWidgets('sin permiso para resolver, solo se consulta', (tester) async {
    await _montar(
      tester,
      incidente: incidenteDePrueba(),
      permisos: {Permisos.verIncidentes},
    );
    final textos = textosEn(tester);

    expect(find.text(textos.incidenteDetalleSoloLectura), findsOneWidget);
    expect(find.text(textos.incidenteResolverGuardar), findsNothing);
  });

  testWidgets('un incidente propio no se resuelve desde aquí', (tester) async {
    await _montar(tester, incidente: incidenteDePrueba(usuarioId: 'u1'));
    final textos = textosEn(tester);

    expect(find.text(textos.incidenteDetallePropio), findsOneWidget);
    expect(find.text(textos.incidenteResolverGuardar), findsNothing);
  });

  testWidgets('junto al formulario explica el umbral de la cuenta', (
    tester,
  ) async {
    await _montar(
      tester,
      incidente: incidenteDePrueba(),
      repositorio: IncidentesRepositorioFalso(
        incidentes: [incidenteDePrueba()],
        politicaDeCuenta: const PoliticaDeIncidentes(
          minimo: 3,
          ventanaDias: 30,
          restriccionAutomatica: true,
        ),
      ),
    );
    final textos = textosEn(tester);

    expect(find.text(textos.incidentesPolitica(3, 30)), findsOneWidget);
    expect(find.text(textos.incidentesPoliticaRestriccion), findsOneWidget);
  });

  testWidgets('confirmar sin motivo no manda nada y lo dice', (tester) async {
    final repo = await _montar(tester, incidente: incidenteDePrueba());
    final textos = textosEn(tester);

    await _confirmarEnFormulario(tester, '   ');
    await _tocar(tester, find.text(textos.incidenteResolverGuardar));
    await tester.pumpAndSettle();

    expect(find.text(textos.incidenteResolverMotivoRequerido), findsOneWidget);
    expect(repo.resoluciones, isEmpty);
  });

  testWidgets('cancelar la confirmación no llama a la API', (tester) async {
    final repo = await _montar(tester, incidente: incidenteDePrueba());
    final textos = textosEn(tester);

    await _confirmarEnFormulario(tester, 'Visto con el guardia');
    await _tocar(tester, find.text(textos.incidenteResolverGuardar));
    await tester.pumpAndSettle();
    expect(find.text(textos.incidenteResolverConfirmarTitulo), findsOneWidget);

    await _tocar(tester, find.text(textos.comunCancelar));
    await tester.pumpAndSettle();

    expect(repo.resoluciones, isEmpty);
  });

  testWidgets(
    'confirmar manda el motivo y muestra la propuesta de reincidencia',
    (tester) async {
      final confirmado = incidenteDePrueba(
        estado: EstadoDeIncidente.confirmado,
      );
      final repo = await _montar(
        tester,
        incidente: incidenteDePrueba(),
        repositorio: IncidentesRepositorioFalso(
          incidentes: [incidenteDePrueba()],
          respuestaResolver: RespuestaDeResolucion(
            incidente: confirmado,
            reincidencia: const ReincidenciaDeIncidente(
              confirmados: 3,
              minimo: 3,
              ventanaDias: 30,
              propuesta: AccionPropuesta.restringir,
              aplicadaAutomaticamente: false,
            ),
          ),
        ),
      );
      final textos = textosEn(tester);

      await _confirmarEnFormulario(tester, 'Visto con el guardia');
      await _tocar(tester, find.text(textos.incidenteResolverGuardar));
      await tester.pumpAndSettle();
      await _tocar(
        tester,
        find.widgetWithText(FilledButton, textos.incidenteResolverConfirmar),
      );
      await tester.pumpAndSettle();

      expect(
        repo.resoluciones.single.resultado,
        ResultadoDeResolucion.confirmado,
      );
      expect(repo.resoluciones.single.motivo, 'Visto con el guardia');
      expect(
        find.text(
          textos.incidenteReincidenciaPropuesta(
            textos.incidenteAccionRestringir,
            'Jorge',
            3,
            3,
            30,
          ),
        ),
        findsOneWidget,
      );
      expect(
        find.text(
          textos.incidenteResolucionGuardada(textos.incidentesEstadoConfirmado),
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets('un error de la API se muestra y la pantalla se queda', (
    tester,
  ) async {
    await _montar(
      tester,
      incidente: incidenteDePrueba(),
      repositorio: IncidentesRepositorioFalso(
        incidentes: [incidenteDePrueba()],
        errorResolver: const ErrorApi(
          code: 'incidente.tope_diario',
          status: 429,
        ),
      ),
    );
    final textos = textosEn(tester);

    await _confirmarEnFormulario(tester, 'Visto');
    await _tocar(tester, find.text(textos.incidenteResolverGuardar));
    await tester.pumpAndSettle();
    await _tocar(
      tester,
      find.widgetWithText(FilledButton, textos.incidenteResolverConfirmar),
    );
    await tester.pumpAndSettle();

    expect(find.text(textos.comunErrorIncidenteTopeDiario), findsOneWidget);
    expect(find.text(textos.incidenteResolverTitulo), findsOneWidget);
  });
}
