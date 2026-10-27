import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/exportacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

Future<({ExportacionRepositorioFalso repo, CompartirArchivoFalso compartir})>
_montar(WidgetTester tester, {ExportacionRepositorioFalso? repositorio}) async {
  final repo = repositorio ?? ExportacionRepositorioFalso();
  final compartir = CompartirArchivoFalso();
  await montarPantalla(
    tester,
    pagina: const ExportacionPagina(),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.exportarDatos})),
      ),
      exportacionRepositorioProvider.overrideWithValue(repo),
      compartirArchivoProvider.overrideWithValue(compartir),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  return (repo: repo, compartir: compartir);
}

void main() {
  testWidgets('ofrece los tres recursos y la primera descarga', (tester) async {
    await _montar(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.exportacionRecursoUsuarios), findsOneWidget);
    expect(find.text(textos.exportacionRecursoPuertas), findsOneWidget);
    expect(find.text(textos.exportacionRecursoLecturas), findsOneWidget);
    expect(find.text(textos.exportacionDescargar), findsOneWidget);
  });

  testWidgets('descargar baja la página, la comparte y lo dice', (
    tester,
  ) async {
    final r = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionDescargar));
    await tester.pumpAndSettle();

    expect(r.repo.pedidos.single.recurso, RecursoExportable.usuarios);
    expect(r.repo.pedidos.single.pagina, 1);
    expect(r.compartir.compartidos.single.nombreArchivo, 'usuarios-agr-p1.csv');
    expect(find.text(textos.exportacionDescargada(1, 1, 2)), findsOneWidget);
    expect(find.text(textos.exportacionDescargarDeNuevo), findsOneWidget);
  });

  testWidgets('con más páginas, el botón pide la que sigue', (tester) async {
    final repo = ExportacionRepositorioFalso(
      paginaEntregada: paginaDePrueba(total: 2500, filas: 1000, hayMas: true),
    );
    await _montar(tester, repositorio: repo);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionDescargar));
    await tester.pumpAndSettle();
    expect(find.text(textos.exportacionSiguiente(2, 3)), findsOneWidget);

    await tester.tap(find.text(textos.exportacionSiguiente(2, 3)));
    await tester.pumpAndSettle();

    expect(repo.pedidos.map((p) => p.pagina), [1, 2]);
  });

  testWidgets('si la página llegó al tope, lo avisa y pide acotar', (
    tester,
  ) async {
    final repo = ExportacionRepositorioFalso(
      paginaEntregada: paginaDePrueba(
        total: 10000,
        filas: 1000,
        truncado: true,
      ),
    );
    await _montar(tester, repositorio: repo);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionDescargar));
    await tester.pumpAndSettle();

    expect(find.text(textos.exportacionTruncado), findsOneWidget);
  });

  testWidgets('sin filas, lo dice y no abre el menú de compartir', (
    tester,
  ) async {
    final repo = ExportacionRepositorioFalso(
      paginaEntregada: paginaDePrueba(total: 0, filas: 0),
    );
    final r = await _montar(tester, repositorio: repo);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionDescargar));
    await tester.pumpAndSettle();

    expect(r.compartir.compartidos, isEmpty);
    expect(find.text(textos.exportacionSinFilas), findsOneWidget);
  });

  testWidgets('un tope de filas de la API se muestra traducido', (
    tester,
  ) async {
    final repo = ExportacionRepositorioFalso(
      error: const ErrorApi(code: 'exportacion.tope_excedido', status: 422),
    );
    await _montar(tester, repositorio: repo);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionDescargar));
    await tester.pumpAndSettle();

    expect(find.text(textos.comunErrorExportacionTopeExcedido), findsOneWidget);
  });

  testWidgets('elegir lecturas muestra sus filtros de resultado y de fecha', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.exportacionResultado), findsNothing);
    await tester.tap(find.text(textos.exportacionRecursoLecturas));
    await tester.pumpAndSettle();

    expect(find.text(textos.exportacionResultado), findsOneWidget);
    expect(find.text(textos.exportacionDesde), findsOneWidget);
    expect(find.text(textos.exportacionHasta), findsOneWidget);
    expect(find.text(textos.exportacionSinLimite), findsNWidgets(2));
  });
}
