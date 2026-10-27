import 'dart:async';

import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

Pagina<String> _pagina(List<String> datos) =>
    Pagina(datos: datos, pagina: 1, porPagina: 20, total: datos.length);

Future<void> _montar(
  WidgetTester tester, {
  required EstadoListado<String> estado,
  Future<void> Function()? alActualizar,
  Size? tamano,
}) => montarPantalla(
  tester,
  tamano: tamano,
  pagina: Scaffold(
    body: ListadoPaginado<String>(
      estado: estado,
      tituloDeError: 'No pudimos cargar',
      alReintentar: () {},
      alCambiarPagina: (_) {},
      alActualizar: alActualizar,
      vacio: const EstadoVacio(titulo: 'Nada por aquí'),
      tarjeta: (context, dato) => Card(child: Text(dato)),
      columnas: [
        ColumnaListado(titulo: 'Nombre', celda: (context, dato) => Text(dato)),
      ],
    ),
  ),
);

void main() {
  testWidgets('tirar hacia abajo una lista vacía llama a alActualizar', (
    tester,
  ) async {
    var actualizadas = 0;
    await _montar(
      tester,
      estado: ListadoConDatos(_pagina(const [])),
      alActualizar: () async => actualizadas++,
    );

    await tester.fling(
      find.byType(RefreshIndicator),
      const Offset(0, 300),
      1000,
    );
    await tester.pumpAndSettle();

    expect(actualizadas, 1);
  });

  testWidgets('tirar hacia abajo una lista con datos llama a alActualizar', (
    tester,
  ) async {
    var actualizadas = 0;
    await _montar(
      tester,
      estado: ListadoConDatos(_pagina(const ['Ana'])),
      alActualizar: () async => actualizadas++,
    );

    await tester.fling(find.text('Ana'), const Offset(0, 300), 1000);
    await tester.pumpAndSettle();

    expect(actualizadas, 1);
  });

  testWidgets('sin alActualizar no hay gesto de actualizar', (tester) async {
    await _montar(tester, estado: ListadoConDatos(_pagina(const ['Ana'])));

    expect(find.byType(RefreshIndicator), findsNothing);
  });

  testWidgets('el gesto espera a que termine la actualización', (tester) async {
    final completar = Completer<void>();
    var pedidas = 0;
    await _montar(
      tester,
      estado: ListadoConDatos(_pagina(const ['Ana'])),
      alActualizar: () {
        pedidas++;
        return completar.future;
      },
    );

    await tester.fling(find.text('Ana'), const Offset(0, 300), 1000);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(RefreshIndicator), findsOneWidget);
    expect(pedidas, 1);

    completar.complete();
    await tester.pumpAndSettle();
    expect(pedidas, 1);
  });

  testWidgets('en 852×393 el vacío no desborda y el título es alcanzable', (
    tester,
  ) async {
    await _montar(
      tester,
      estado: ListadoConDatos(_pagina(const [])),
      alActualizar: () async {},
      tamano: const Size(852, 393),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Nada por aquí'), findsOneWidget);
    await tester.ensureVisible(find.text('Nada por aquí'));
    expect(tester.takeException(), isNull);
  });
}
