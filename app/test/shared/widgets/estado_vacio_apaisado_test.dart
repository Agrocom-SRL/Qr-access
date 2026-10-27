import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

void main() {
  testWidgets('en poco alto la ilustración baja a 88 dp y el título se ve', (
    tester,
  ) async {
    await montarPantalla(
      tester,
      tamano: const Size(852, 393),
      pagina: const Scaffold(
        body: EstadoVacio(
          titulo: 'Sin nada',
          ilustracion: 'assets/ilustraciones/vacio_eventos.svg',
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(SvgPicture)).height, 88);
    expect(find.text('Sin nada'), findsOneWidget);
  });

  testWidgets('en vertical la ilustración conserva su tamaño de 160 dp', (
    tester,
  ) async {
    await montarPantalla(
      tester,
      pagina: const Scaffold(
        body: EstadoVacio(
          titulo: 'Sin nada',
          ilustracion: 'assets/ilustraciones/vacio_eventos.svg',
        ),
      ),
    );

    expect(tester.getSize(find.byType(SvgPicture)).height, 160);
  });
}
