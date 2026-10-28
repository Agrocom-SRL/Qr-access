import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/exportacion_falsa.dart';
import '../../../helpers/pantalla.dart';
import 'montaje_exportacion.dart';

void main() {
  testWidgets('ofrece tres tarjetas que se tocan enteras, sin botones', (
    tester,
  ) async {
    await montarExportacion(tester, pagina: const ExportacionPagina());
    final textos = textosEn(tester);

    expect(find.text(textos.exportacionRecursoUsuarios), findsOneWidget);
    expect(find.text(textos.exportacionRecursoPuertas), findsOneWidget);
    expect(find.text(textos.exportacionRecursoLecturas), findsOneWidget);
    expect(find.byType(AccesoBoton), findsNothing);
  });

  testWidgets('Usuarios abre la hoja de formatos y el Excel baja con su tipo', (
    tester,
  ) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionRecursoUsuarios));
    await tester.pumpAndSettle();
    expect(find.text(textos.exportacionFormatoTitulo), findsOneWidget);
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    expect(r.repo.pedidos.single.recurso, RecursoExportable.usuarios);
    expect(r.repo.pedidos.single.pagina, 1);
    expect(
      r.compartir.compartidos.single.nombreArchivo,
      'usuarios-agr-p1.xlsx',
    );
    expect(
      r.compartir.compartidos.single.mimeType,
      FormatoDeDescarga.xlsx.mimeType,
    );
    expect(find.text(textos.exportacionDescargada(1, 1, 2)), findsOneWidget);
  });

  testWidgets('Puertas baja su propio recurso', (tester) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionRecursoPuertas));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    expect(r.repo.pedidos.single.recurso, RecursoExportable.puertas);
  });

  testWidgets('sin filas, lo dice y no abre el menú de compartir', (
    tester,
  ) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
      repositorio: ExportacionRepositorioFalso(
        paginaEntregada: paginaDePrueba(total: 0, filas: 0),
      ),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionRecursoUsuarios));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    expect(r.compartir.compartidos, isEmpty);
    expect(find.text(textos.exportacionSinFilas), findsOneWidget);
  });

  testWidgets('un tope de filas de la API se muestra traducido', (
    tester,
  ) async {
    await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
      repositorio: ExportacionRepositorioFalso(
        error: const ErrorApi(code: 'exportacion.tope_excedido', status: 422),
      ),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionRecursoUsuarios));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    expect(find.text(textos.comunErrorExportacionTopeExcedido), findsOneWidget);
  });

  testWidgets('sin conexión al bajar, lo dice traducido', (tester) async {
    await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
      repositorio: ExportacionRepositorioFalso(
        error: const ErrorApi(code: ErrorApi.sinConexion),
      ),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionRecursoUsuarios));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    expect(find.text(textos.comunErrorSinConexion), findsOneWidget);
  });

  testWidgets('Accesos a puertas abre su propia pantalla de filtros', (
    tester,
  ) async {
    await montarExportacion(tester, pagina: const ExportacionPagina());
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionRecursoLecturas));
    await tester.pumpAndSettle();

    expect(find.text('destino ${Rutas.exportarAccesos}'), findsOneWidget);
  });
}
