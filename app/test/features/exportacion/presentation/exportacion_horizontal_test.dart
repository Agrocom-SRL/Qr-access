import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/exportacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/horizontal.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

Future<ExportacionRepositorioFalso> _montar(
  WidgetTester tester, {
  ExportacionRepositorioFalso? repositorio,
}) async {
  final repo = repositorio ?? ExportacionRepositorioFalso();
  await montarPantalla(
    tester,
    pagina: const ExportacionPagina(),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.exportarDatos})),
      ),
      exportacionRepositorioProvider.overrideWithValue(repo),
      compartirArchivoProvider.overrideWithValue(CompartirArchivoFalso()),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  return repo;
}

void main() {
  testWidgets('en horizontal se ve completa, con scroll, sin desbordar', (
    tester,
  ) async {
    await _montar(tester);
    usarHorizontal(tester);
    await tester.pumpAndSettle();
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(textos.exportacionDescargar), findsOneWidget);
  });

  testWidgets('en horizontal, los filtros de lecturas caben y se desplazan', (
    tester,
  ) async {
    await _montar(tester);
    usarHorizontal(tester);
    await tester.pumpAndSettle();
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionRecursoLecturas));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text(textos.exportacionDesde), findsOneWidget);
    expect(find.text(textos.exportacionHasta), findsOneWidget);
  });

  testWidgets('sin conexión al bajar, la ilustración lo dice sin botón extra', (
    tester,
  ) async {
    await _montar(
      tester,
      repositorio: ExportacionRepositorioFalso(
        error: const ErrorApi(code: ErrorApi.sinConexion),
      ),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionDescargar));
    await tester.pumpAndSettle();

    expect(find.byType(EstadoVacio), findsOneWidget);
    expect(find.text(textos.comunErrorSinConexion), findsOneWidget);
    // El botón de abajo ya vuelve a bajar: el estado vacío no repite la acción.
    expect(find.text(textos.comunReintentar), findsNothing);
  });
}
