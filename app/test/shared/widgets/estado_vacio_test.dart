import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_ilustracion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

Future<void> _montar(
  WidgetTester tester,
  Widget estado, {
  ThemeData? tema,
  bool expandida = false,
}) async {
  await montarPantalla(
    tester,
    pagina: Scaffold(body: estado),
    tema: tema,
    expandida: expandida,
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('la ilustración mide 160 dp y va arriba del título', (
    tester,
  ) async {
    await _montar(
      tester,
      const EstadoVacio(titulo: 'Sin QR', ilustracion: Multimedia.vacioQr),
    );
    final ilustracion = find.byType(SvgPicture);
    expect(tester.getSize(ilustracion), const Size(160, 160));
    expect(
      tester.getBottomLeft(ilustracion).dy,
      lessThan(tester.getTopLeft(find.text('Sin QR')).dy),
    );
  });

  testWidgets('en expandido mide 200 dp', (tester) async {
    await _montar(
      tester,
      const EstadoVacio(titulo: 'Sin QR', ilustracion: Multimedia.vacioQr),
      expandida: true,
    );
    expect(tester.getSize(find.byType(SvgPicture)), const Size(200, 200));
  });

  testWidgets('es decorativa: los lectores de pantalla la saltan', (
    tester,
  ) async {
    final semantica = tester.ensureSemantics();
    await _montar(
      tester,
      const EstadoVacio(titulo: 'Sin QR', ilustracion: Multimedia.vacioQr),
    );
    final decorativa = tester.widget<Semantics>(
      find
          .descendant(
            of: find.byType(AccesoIlustracion),
            matching: find.byType(Semantics),
          )
          .first,
    );
    expect(decorativa.properties.label, isNull);
    expect(decorativa.excludeSemantics, isTrue);
    semantica.dispose();
  });

  testWidgets('error y sin conexión traen su ilustración', (tester) async {
    await _montar(tester, EstadoVacio.error(titulo: 'x', alReintentar: () {}));
    expect(
      tester.widget<SvgPicture>(find.byType(SvgPicture)).bytesLoader,
      isA<SvgAssetLoader>().having(
        (l) => l.assetName,
        'assetName',
        Multimedia.error,
      ),
    );
    await _montar(
      tester,
      EstadoVacio.sinConexion(titulo: 'x', alReintentar: () {}),
    );
    expect(
      (tester.widget<SvgPicture>(find.byType(SvgPicture)).bytesLoader
              as SvgAssetLoader)
          .assetName,
      Multimedia.sinConexion,
    );
  });

  group('goldens', () {
    for (final (nombre, tema) in [
      ('claro', Tema.claro),
      ('oscuro', Tema.oscuro),
    ]) {
      testWidgets('EstadoVacio en $nombre', (tester) async {
        await _montar(
          tester,
          const EstadoVacio(
            titulo: 'Sin QR',
            ayuda: 'Emite uno para entrar',
            ilustracion: Multimedia.vacioQr,
          ),
          tema: tema,
        );
        await expectLater(
          find.byType(EstadoVacio),
          matchesGoldenFile('goldens/estado_vacio_$nombre.png'),
        );
      });
    }
  });
}
