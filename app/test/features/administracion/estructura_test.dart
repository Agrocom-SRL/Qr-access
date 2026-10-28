import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/estructura_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/barra_navegacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

const _sitios = [
  SitioGestionado(
    id: 's1',
    nombre: 'Planta Norte',
    direccion: 'Av. Cristo Redentor 120',
    puertas: [
      PuertaGestionada(
        id: 'p1',
        nombre: 'Portón vehicular',
        segundosApertura: 8,
        activa: true,
        tieneLector: true,
      ),
      PuertaGestionada(
        id: 'p2',
        nombre: 'Peatonal',
        segundosApertura: 5,
        activa: true,
        tieneLector: false,
      ),
    ],
  ),
];

const Set<String> _administrador = {
  Permisos.administrarSitios,
  Permisos.administrarPuertas,
};

Future<EstructuraRepositorioFalso> _montar(
  WidgetTester tester, {
  Set<String> permisos = _administrador,
  bool apaisada = false,
}) async {
  final repositorio = EstructuraRepositorioFalso(_sitios);
  await montarPantalla(
    tester,
    pagina: const EstructuraPagina(),
    apaisada: apaisada,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      estructuraRepositorioProvider.overrideWithValue(repositorio),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(const []),
      ),
    ],
  );
  await tester.pumpAndSettle();
  return repositorio;
}

void main() {
  testWidgets('lista los sitios con sus puertas y los segundos de apertura', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    expect(find.text('Planta Norte'), findsOneWidget);
    expect(find.text('Portón vehicular'), findsOneWidget);
    expect(find.text('Peatonal'), findsOneWidget);
    expect(find.text(textos.estructuraPuertaSegundosValor(8)), findsOneWidget);
  });

  testWidgets('crea un sitio desde la hoja inferior', (tester) async {
    final repositorio = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.estructuraSitioNuevo));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '  Planta Sur ');
    await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
    await tester.pumpAndSettle();

    expect(repositorio.sitiosCreados.single.nombre, 'Planta Sur');
  });

  testWidgets('no crea una puerta sin nombre ni con segundos fuera de rango', (
    tester,
  ) async {
    final repositorio = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.estructuraPuertaNueva));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
    await tester.pump();
    expect(find.text(textos.estructuraErrorNombre), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Trasera');
    await tester.enterText(find.byType(TextField).last, '99');
    await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
    await tester.pump();
    expect(find.text(textos.estructuraErrorSegundos), findsOneWidget);
    expect(repositorio.puertasCreadas, isEmpty);

    await tester.enterText(find.byType(TextField).last, '12');
    await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
    await tester.pumpAndSettle();
    final (sitioId, datos) = repositorio.puertasCreadas.single;
    expect(sitioId, 's1');
    expect(datos.nombre, 'Trasera');
    expect(datos.segundosApertura, 12);
  });

  testWidgets('eliminar una puerta pide confirmación', (tester) async {
    final repositorio = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.comunEliminar).at(1));
    await tester.pumpAndSettle();
    expect(
      find.text(textos.estructuraEliminarPuertaTitulo('Portón vehicular')),
      findsOneWidget,
    );
    await tester.tap(find.widgetWithText(FilledButton, textos.comunEliminar));
    await tester.pumpAndSettle();

    expect(repositorio.puertasEliminadas, ['p1']);
  });

  testWidgets('sin los permisos de administrar no hay acciones', (
    tester,
  ) async {
    await _montar(tester, permisos: const {});
    final textos = textosEn(tester);

    expect(find.text('Planta Norte'), findsOneWidget);
    expect(find.byTooltip(textos.estructuraSitioNuevo), findsNothing);
    expect(find.text(textos.estructuraPuertaNueva), findsNothing);
    expect(find.byTooltip(textos.comunEliminar), findsNothing);
  });

  testWidgets('en horizontal (852×393) los sitios se desplazan sin desbordar', (
    tester,
  ) async {
    await _montar(tester, apaisada: true);

    expect(find.byType(BarraNavegacion), findsOneWidget);
    expect(find.text(textosEn(tester).estructuraTitulo), findsOneWidget);
  });
}
