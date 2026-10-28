import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_nav_bar/google_nav_bar.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

const Set<String> _usuario = {
  Permisos.verPuertas,
  Permisos.generarQr,
  Permisos.generarQrPropio,
  Permisos.verQr,
  Permisos.anularQr,
  Permisos.verEventos,
};
const Set<String> _guardia = {
  Permisos.verPuertas,
  Permisos.generarQrPropio,
  Permisos.supervisarPuertas,
  Permisos.verEventos,
  Permisos.verTodosLosEventos,
};

/// Monta una plantilla de administración con la sesión de [permisos] y devuelve
/// las etiquetas de la barra inferior, en su orden. [tamano] se aplica después
/// de montar: `montarPantalla` arranca en compacto vertical.
Future<List<String?>> _etiquetasEn(
  WidgetTester tester, {
  required Set<String> permisos,
  required Size tamano,
}) async {
  await montarPantalla(
    tester,
    pagina: const PlantillaAdmin(
      destino: DestinoNav.inicio,
      child: SizedBox.shrink(),
    ),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
    ],
  );
  tester.view
    ..physicalSize = tamano
    ..devicePixelRatio = 1;
  await tester.pumpAndSettle();
  return [
    for (final boton in tester.widgetList<GButton>(find.byType(GButton)))
      boton.text,
  ];
}

void main() {
  testWidgets(
    'en 852×393 (horizontal) el usuario ve 5 destinos y todos caben',
    (tester) async {
      final etiquetas = await _etiquetasEn(
        tester,
        permisos: _usuario,
        tamano: tamanoApaisado,
      );
      final textos = textosEn(tester);

      expect(etiquetas, [
        textos.navInicio,
        textos.navGenerarQr,
        textos.navMisQr,
        textos.navLecturas,
        textos.navPerfil,
      ]);
      expect(tester.takeException(), isNull);
      // Cada pestaña queda dentro del ancho de la pantalla: son alcanzables.
      for (final rect
          in tester
              .widgetList<GButton>(find.byType(GButton))
              .map((boton) => tester.getRect(find.byWidget(boton)))) {
        expect(rect.left, greaterThanOrEqualTo(0));
        expect(rect.right, lessThanOrEqualTo(tamanoApaisado.width));
      }
    },
  );

  testWidgets('en 393×852 (vertical) el usuario sigue con 4 destinos', (
    tester,
  ) async {
    final etiquetas = await _etiquetasEn(
      tester,
      permisos: _usuario,
      tamano: const Size(393, 852),
    );
    final textos = textosEn(tester);

    expect(etiquetas, [
      textos.navInicio,
      textos.navMisQr,
      textos.navLecturas,
      textos.navPerfil,
    ]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('en 852×393 el guardia sigue con 4, porque no tiene más', (
    tester,
  ) async {
    final etiquetas = await _etiquetasEn(
      tester,
      permisos: _guardia,
      tamano: tamanoApaisado,
    );

    expect(etiquetas, hasLength(4));
  });
}
