import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/anulacion_masiva_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_ilustracion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/anulacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/horizontal.dart';
import '../../../helpers/pantalla.dart';

/// Alto que ocupa el teclado en el iPhone en horizontal (aprox., en dp).
const _altoTeclado = 200.0;

/// Los tamaños donde la pantalla no debe desbordar: vertical, horizontal de
/// teléfono, tablet y escritorio.
const _tamanos = [Size(393, 852), Size(1024, 768), Size(1280, 800)];

Future<AnulacionMasivaRepositorioFalso> _montar(
  WidgetTester tester, {
  AnulacionMasivaRepositorioFalso? repositorio,
  Size? tamano,
}) async {
  final repo = repositorio ?? AnulacionMasivaRepositorioFalso();
  await montarPantalla(
    tester,
    pagina: const AnularQrPagina(),
    tamano: tamano,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.anularQrDeRama})),
      ),
      anulacionMasivaRepositorioProvider.overrideWithValue(repo),
    ],
  );
  await tester.pumpAndSettle();
  return repo;
}

Finder _confirmar(String texto) => find.widgetWithText(AccesoBoton, texto);

void main() {
  testWidgets('sin motivo, confirmar no hace nada', (tester) async {
    final repo = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(_confirmar(textos.qrAnulacionMiRamaConfirmar));
    await tester.pumpAndSettle();

    expect(repo.motivos, isEmpty);
    expect(find.text(textos.qrAnulacionMiRamaTitulo), findsOneWidget);
  });

  testWidgets('muestra la ilustración de anulación, no un ícono', (
    tester,
  ) async {
    await _montar(tester);

    final ilustracion = tester.widget<AccesoIlustracion>(
      find.byType(AccesoIlustracion),
    );
    expect(ilustracion.ruta, Multimedia.anulacion);
    expect(find.byIcon(Icons.block), findsNothing);
  });

  testWidgets('la X vuelve a Seguridad y datos sin llamar a la API', (tester) async {
    final repo = await _montar(tester);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();

    expect(repo.motivos, isEmpty);
    expect(find.text('destino ${Rutas.seguridad}'), findsOneWidget);
  });

  testWidgets(
    'con motivo, confirmar lo manda y vuelve a Seguridad y datos con el resultado',
    (tester) async {
      final repo = await _montar(tester);
      final textos = textosEn(tester);

      await tester.enterText(find.byType(TextField), '  PIN filtrado  ');
      await tester.pump();
      await tester.tap(_confirmar(textos.qrAnulacionMiRamaConfirmar));
      await tester.pumpAndSettle();

      expect(repo.motivos, ['PIN filtrado']);
      expect(find.text('destino ${Rutas.seguridad}'), findsOneWidget);
      expect(find.text(textos.qrAnulacionMiRamaResultado(3)), findsOneWidget);
    },
  );

  testWidgets('un rechazo de la API se muestra traducido y se queda aquí', (
    tester,
  ) async {
    final repo = await _montar(
      tester,
      repositorio: AnulacionMasivaRepositorioFalso(
        error: const ErrorApi(
          code: 'anulacion.alcance_no_permitido',
          status: 403,
        ),
      ),
    );
    final textos = textosEn(tester);

    await tester.enterText(find.byType(TextField), 'PIN');
    await tester.pump();
    await tester.tap(_confirmar(textos.qrAnulacionMiRamaConfirmar));
    await tester.pumpAndSettle();

    expect(repo.motivos, ['PIN']);
    expect(
      find.text(textos.comunErrorAnulacionAlcanceNoPermitido),
      findsOneWidget,
    );
    expect(find.text(textos.qrAnulacionMiRamaTitulo), findsOneWidget);
  });

  testWidgets('en 852×393 el motivo y el botón se ven sin desplazarse', (
    tester,
  ) async {
    await _montar(tester, tamano: tamanoHorizontal);
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(TextField).hitTestable(), findsOneWidget);
    expect(
      find.text(textos.qrAnulacionMiRamaMotivo).hitTestable(),
      findsOneWidget,
    );
    expect(
      _confirmar(textos.qrAnulacionMiRamaConfirmar).hitTestable(),
      findsOneWidget,
    );
    expect(
      find.text(textos.qrAnulacionMiRamaMensaje).hitTestable(),
      findsOneWidget,
    );
  });

  testWidgets(
    'en 852×393 con teclado, el motivo y el botón siguen alcanzables',
    (tester) async {
      await _montar(tester, tamano: tamanoHorizontal);
      final textos = textosEn(tester);

      await tester.tap(find.byType(TextField));
      await tester.pump();
      tester.view.viewInsets = const FakeViewPadding(bottom: _altoTeclado);
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byType(TextField));
      await tester.pumpAndSettle();
      expect(find.byType(TextField).hitTestable(), findsOneWidget);
      expect(
        _confirmar(textos.qrAnulacionMiRamaConfirmar).hitTestable(),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  for (final tamano in _tamanos) {
    testWidgets(
      'en ${tamano.width.toInt()}×${tamano.height.toInt()} no desborda',
      (tester) async {
        await _montar(tester, tamano: tamano);
        final textos = textosEn(tester);

        expect(tester.takeException(), isNull);
        expect(
          _confirmar(textos.qrAnulacionMiRamaConfirmar).hitTestable(),
          findsOneWidget,
        );
      },
    );
  }
}
