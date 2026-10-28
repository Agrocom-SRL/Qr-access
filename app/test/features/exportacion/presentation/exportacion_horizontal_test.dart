import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/horizontal.dart';
import '../../../helpers/pantalla.dart';
import 'montaje_exportacion.dart';

void main() {
  testWidgets(
    'en 852×393, los accesos muestran las pestañas y Descargar a la vista',
    (tester) async {
      await montarExportacion(
        tester,
        pagina: const ExportarAccesosPagina(),
        tamano: tamanoHorizontal,
      );
      final textos = textosEn(tester);

      expect(tester.takeException(), isNull);
      expect(find.text(textos.exportacionTodos).hitTestable(), findsOneWidget);
      expect(
        find
            .widgetWithText(AccesoBoton, textos.exportacionDescargar)
            .hitTestable(),
        findsOneWidget,
      );
    },
  );

  testWidgets('en 852×393, la lista muestra las tarjetas sin desbordar', (
    tester,
  ) async {
    await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
      tamano: tamanoHorizontal,
    );
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    expect(
      find.text(textos.exportacionRecursoUsuarios).hitTestable(),
      findsOneWidget,
    );
  });
}
