import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

Pagina<String> _pagina(List<String> datos, {int pagina = 1, int total = 0}) =>
    Pagina(
      datos: datos,
      pagina: pagina,
      porPagina: 2,
      total: total == 0 ? datos.length : total,
    );

Future<List<int>> _montar(
  WidgetTester tester, {
  required EstadoListado<String> estado,
  bool expandida = false,
}) async {
  final paginasPedidas = <int>[];
  await montarPantalla(
    tester,
    expandida: expandida,
    pagina: Scaffold(
      body: ListadoPaginado<String>(
        estado: estado,
        tituloDeError: 'No pudimos cargar',
        alReintentar: () {},
        alCambiarPagina: paginasPedidas.add,
        vacio: const EstadoVacio(titulo: 'Nada por aquí'),
        encabezadoDe: (dato, anterior) =>
            anterior == null || anterior[0] != dato[0]
            ? 'Grupo ${dato[0]}'
            : null,
        tarjeta: (context, dato) => Card(child: Text(dato)),
        columnas: [
          ColumnaListado(
            titulo: 'Nombre',
            celda: (context, dato) => Text(dato),
          ),
          ColumnaListado(
            titulo: 'Largo',
            celda: (context, dato) => Text('${dato.length}'),
          ),
        ],
      ),
    ),
  );
  await tester.pump();
  return paginasPedidas;
}

void main() {
  testWidgets('en compacto rinde tarjetas con encabezados de grupo', (
    tester,
  ) async {
    await _montar(
      tester,
      estado: ListadoConDatos(_pagina(['Ana', 'Alba', 'Beto'])),
    );

    expect(find.byType(Card), findsNWidgets(3));
    expect(find.text('GRUPO A'), findsOneWidget);
    expect(find.text('GRUPO B'), findsOneWidget);
    expect(find.byType(DataTable), findsNothing);
  });

  testWidgets('en compacto, "Cargar más" pide la página siguiente', (
    tester,
  ) async {
    final pedidas = await _montar(
      tester,
      estado: ListadoConDatos(_pagina(['Ana', 'Alba'], total: 5)),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.comunCargarMas));
    expect(pedidas, [2]);
  });

  testWidgets('en expandido rinde una tabla con rango y flechas', (
    tester,
  ) async {
    final pedidas = await _montar(
      tester,
      estado: ListadoConDatos(_pagina(['Ana', 'Alba'], total: 5)),
      expandida: true,
    );
    final textos = textosEn(tester);

    expect(find.byType(DataTable), findsOneWidget);
    expect(find.text('Nombre'), findsOneWidget);
    expect(find.text(textos.comunRangoDe(1, 2, 5)), findsOneWidget);
    await tester.tap(find.byTooltip(textos.comunPaginaSiguiente));
    expect(pedidas, [2]);
  });

  testWidgets('cargando muestra el skeleton accesible', (tester) async {
    await _montar(tester, estado: const ListadoCargando());
    expect(
      find.bySemanticsLabel(textosEn(tester).comunCargando),
      findsOneWidget,
    );
  });

  testWidgets('vacío muestra lo que pase la pantalla', (tester) async {
    await _montar(tester, estado: ListadoConDatos(_pagina(const [])));
    expect(find.text('Nada por aquí'), findsOneWidget);
  });

  testWidgets('error y sin conexión ofrecen Reintentar', (tester) async {
    await _montar(tester, estado: const ListadoConError(sinConexion: true));
    final textos = textosEn(tester);
    expect(find.text('No pudimos cargar'), findsOneWidget);
    expect(find.text(textos.comunSinConexionAyuda), findsOneWidget);
    expect(find.text(textos.comunReintentar), findsOneWidget);
  });

  testWidgets('con datos en caché y sin red muestra el banner', (tester) async {
    await _montar(
      tester,
      estado: ListadoConDatos(
        _pagina(['Ana']),
        horaDeLosDatosSinConexion: '10:12',
      ),
    );
    expect(
      find.text(textosEn(tester).comunSinConexionDatosDe('10:12')),
      findsOneWidget,
    );
    expect(find.text('Ana'), findsOneWidget);
  });
}
