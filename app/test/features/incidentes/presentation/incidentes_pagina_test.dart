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

Future<IncidentesRepositorioFalso> _montar(
  WidgetTester tester, {
  List<Incidente> incidentes = const [],
  IncidentesRepositorioFalso? repositorio,
  bool expandida = false,
}) async {
  final repo =
      repositorio ?? IncidentesRepositorioFalso(incidentes: incidentes);
  await montarPantalla(
    tester,
    pagina: const IncidentesPagina(),
    expandida: expandida,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.verIncidentes})),
      ),
      incidentesRepositorioProvider.overrideWithValue(repo),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repo;
}

void main() {
  testWidgets('muestra cada incidente con su usuario, su tipo y su estado', (
    tester,
  ) async {
    await _montar(
      tester,
      incidentes: [
        incidenteDePrueba(),
        incidenteDePrueba(
          id: '8',
          usuarioEtiqueta: null,
          tipo: TipoDeIncidente.pinCompartido,
          estado: EstadoDeIncidente.confirmado,
        ),
      ],
    );
    final textos = textosEn(tester);

    expect(find.text('Jorge'), findsOneWidget);
    expect(find.text(textos.incidentesUsuarioSinNombre), findsOneWidget);
    expect(find.text(textos.incidentesTipoUsoImposible), findsOneWidget);
    expect(find.text(textos.incidentesEstadoConfirmado), findsOneWidget);
  });

  testWidgets('sin incidentes con estos filtros, lo dice', (tester) async {
    await _montar(tester);

    expect(find.text(textosEn(tester).incidentesVacioTitulo), findsOneWidget);
  });

  testWidgets('si no carga, lo dice y se puede reintentar', (tester) async {
    final repo = await _montar(
      tester,
      repositorio: IncidentesRepositorioFalso(
        errorListar: const ErrorApi(code: 'validacion.invalida', status: 400),
      ),
    );
    final textos = textosEn(tester);

    expect(find.text(textos.incidentesErrorCargar), findsOneWidget);
    final antes = repo.tiposPedidos.length;
    await tester.tap(find.text(textos.comunReintentar));
    await tester.pump();
    expect(repo.tiposPedidos.length, greaterThan(antes));
  });

  testWidgets('elegir un tipo pide a la API solo ese tipo', (tester) async {
    final repo = await _montar(tester, incidentes: [incidenteDePrueba()]);
    final textos = textosEn(tester);

    // El primer desplegable es el de tipo; sin filtro, muestra «Todos».
    await tester.tap(find.text(textos.incidentesFiltroTodos).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text(textos.incidentesTipoUsoMasivo).last);
    await tester.pumpAndSettle();

    expect(repo.tiposPedidos.last, TipoDeIncidente.usoMasivo);
  });

  testWidgets('tocar un incidente abre su detalle', (tester) async {
    await _montar(tester, incidentes: [incidenteDePrueba()]);

    await tester.tap(find.text('Jorge'));
    await tester.pumpAndSettle();

    expect(find.text('destino /incidentes/7'), findsOneWidget);
  });

  testWidgets('en expandido, la tabla trae la acción Ver de cada fila', (
    tester,
  ) async {
    await _montar(tester, incidentes: [incidenteDePrueba()], expandida: true);
    final textos = textosEn(tester);

    expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
    expect(find.byTooltip(textos.incidentesVer('Jorge')), findsOneWidget);
  });
}
