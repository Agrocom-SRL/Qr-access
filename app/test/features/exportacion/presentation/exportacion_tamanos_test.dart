import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/pantalla.dart';
import 'montaje_exportacion.dart';

/// Vertical de teléfono, tablet y escritorio: ninguna pantalla de exportación
/// puede desbordar, y la acción principal queda a la vista.
const _tamanos = [Size(393, 852), Size(1024, 768), Size(1280, 800)];

void main() {
  for (final tamano in _tamanos) {
    final nombre = '${tamano.width.toInt()}×${tamano.height.toInt()}';

    testWidgets('la lista en $nombre no desborda', (tester) async {
      await montarExportacion(
        tester,
        pagina: const ExportacionPagina(),
        tamano: tamano,
      );
      final textos = textosEn(tester);

      expect(tester.takeException(), isNull);
      expect(
        find.text(textos.exportacionRecursoUsuarios).hitTestable(),
        findsOneWidget,
      );
    });

    testWidgets('los accesos en $nombre no desbordan', (tester) async {
      await montarExportacion(
        tester,
        pagina: const ExportarAccesosPagina(),
        tamano: tamano,
      );
      final textos = textosEn(tester);

      expect(tester.takeException(), isNull);
      expect(find.text(textos.exportacionTodos).hitTestable(), findsOneWidget);
      expect(
        find.byTooltip(textos.exportacionDescargar).hitTestable(),
        findsOneWidget,
      );
    });
  }
}
