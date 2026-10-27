import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/presentation/ingreso_pagina.dart';
import 'package:agrocom_acceso/features/sesion/presentation/widgets/casillas_pin.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const _inicio = RespuestaInicio(
  acceso: 'acc',
  refresco: 'ref',
  usuario: usuarioDePrueba,
  cuenta: cuentaDePrueba,
  rolActivoId: 'r1',
);

Finder get _campoPin => find.byType(TextField);

Finder _botonIngresar(WidgetTester tester) =>
    find.widgetWithText(FilledButton, textosEn(tester).sesionBotonIngresar);

bool _habilitado(WidgetTester tester) =>
    tester.widget<FilledButton>(_botonIngresar(tester)).enabled;

/// Monta el ingreso con sus dependencias falsas y devuelve las que el test
/// mira.
Future<({SesionRepositorioFalso repositorio, SesionFalsa sesion})> _montar(
  WidgetTester tester, {
  SesionRepositorioFalso? repositorio,
  ThemeData? tema,
  bool expandida = false,
  bool apaisada = false,
  Size? tamano,
}) async {
  final repo = repositorio ?? SesionRepositorioFalso(respuesta: _inicio);
  final sesion = SesionFalsa();
  await montarPantalla(
    tester,
    pagina: const IngresoPagina(),
    tema: tema,
    expandida: expandida,
    apaisada: apaisada,
    overrides: [
      sesionRepositorioProvider.overrideWithValue(repo),
      sesionControladorProvider.overrideWith(() => sesion),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  // Un tamaño propio (vertical, tablet, web) se aplica después de montar.
  if (tamano != null) {
    usarTamano(tester, tamano);
  }
  await tester.pump();
  return (repositorio: repo, sesion: sesion);
}

Rect _rect(WidgetTester tester, Finder finder) => tester.getRect(finder);

/// Alto del área que el teclado deja libre en el test (el iPhone en horizontal
/// abre un teclado de unos 200 dp).
const _altoTeclado = 200.0;

void main() {
  for (final (nombre, tema) in [
    ('claro', Tema.claro),
    ('oscuro', Tema.oscuro),
  ]) {
    testWidgets(
      'muestra título, casillas y botón deshabilitado (tema $nombre)',
      (tester) async {
        await _montar(tester, tema: tema);
        final textos = textosEn(tester);

        expect(find.text(textos.sesionIngresoTitulo), findsOneWidget);
        expect(find.text(textos.sesionPinLeyenda), findsOneWidget);
        expect(find.bySemanticsLabel(textos.sesionCampoPin), findsOneWidget);
        expect(_habilitado(tester), isFalse);
      },
    );
  }

  testWidgets('el PIN se escribe en mayúsculas, sin espacios ni guiones', (
    tester,
  ) async {
    await _montar(tester);

    await tester.enterText(_campoPin, 'agr-7k2q');
    await tester.pump();

    expect(tester.widget<TextField>(_campoPin).controller?.text, 'AGR7K2Q');
    expect(find.text('Q'), findsOneWidget);
    expect(_habilitado(tester), isTrue);
  });

  testWidgets('Ocultar reemplaza los caracteres por puntos', (tester) async {
    await _montar(tester);
    final textos = textosEn(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(find.text(textos.sesionOcultarPin));
    await tester.pump();

    expect(find.text('Q'), findsNothing);
    expect(find.text('•'), findsNWidgets(7));
    expect(find.text(textos.sesionMostrarPin), findsOneWidget);
  });

  testWidgets('con menos de 7 caracteres, Ingresar sigue deshabilitado', (
    tester,
  ) async {
    final (:repositorio, sesion: _) = await _montar(tester);

    await tester.enterText(_campoPin, 'AGR7K');
    await tester.pump();

    expect(_habilitado(tester), isFalse);
    expect(repositorio.pinesRecibidos, isEmpty);
  });

  testWidgets('un PIN válido inicia la sesión con la respuesta de la API', (
    tester,
  ) async {
    final (:repositorio, :sesion) = await _montar(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(_botonIngresar(tester));
    await tester.pump();
    await tester.pump();

    expect(repositorio.pinesRecibidos.single.valor, 'AGR7K2Q');
    expect(sesion.inicios.single, _inicio);
  });

  testWidgets('un PIN rechazado muestra "PIN incorrecto"', (tester) async {
    await _montar(
      tester,
      repositorio: SesionRepositorioFalso(
        error: const ErrorApi(
          code: 'sesion.credenciales_invalidas',
          status: 401,
        ),
      ),
    );
    final textos = textosEn(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(_botonIngresar(tester));
    await tester.pump();
    await tester.pump();

    expect(
      find.text(textos.comunErrorSesionCredencialesInvalidas),
      findsOneWidget,
    );
  });

  testWidgets('el bloqueo muestra la cuenta regresiva y deshabilita todo', (
    tester,
  ) async {
    await _montar(
      tester,
      repositorio: SesionRepositorioFalso(
        error: const ErrorApi(
          code: 'sesion.bloqueada',
          status: 429,
          detalles: {'reintentar_en_segundos': 292},
        ),
      ),
    );
    final textos = textosEn(tester);

    await tester.enterText(_campoPin, 'AGR7K2Q');
    await tester.pump();
    await tester.tap(_botonIngresar(tester));
    await tester.pump();
    await tester.pump();

    expect(find.text(textos.comunErrorSesionBloqueada), findsOneWidget);
    expect(find.text('04:52'), findsOneWidget);
    expect(_habilitado(tester), isFalse);
    expect(tester.widget<TextField>(_campoPin).enabled, isFalse);
  });

  testWidgets('la flecha vuelve a la bienvenida', (tester) async {
    await _montar(tester);
    await tester.tap(find.byTooltip(textosEn(tester).comunVolver));
    await tester.pumpAndSettle();
    expect(find.text('destino /bienvenida'), findsOneWidget);
  });

  testWidgets('en expandido muestra el panel de marca', (tester) async {
    await _montar(tester, expandida: true);
    expect(find.text(textosEn(tester).bienvenidaFrase), findsOneWidget);
  });

  group('teléfono en horizontal (852×393)', () {
    testWidgets('la foto va a un lado y ocupa todo el alto', (tester) async {
      await _montar(tester, apaisada: true);
      final foto = _rect(tester, find.byType(CabeceraFoto));
      final titulo = _rect(
        tester,
        find.text(textosEn(tester).sesionIngresoTitulo),
      );

      expect(foto.height, tamanoApaisado.height);
      expect(foto.right, lessThanOrEqualTo(titulo.left));
      expect(tester.takeException(), isNull);
    });

    testWidgets('la foto se funde hacia el formulario, sin corte seco', (
      tester,
    ) async {
      await _montar(tester, apaisada: true);
      final foto = tester.widget<AccesoFoto>(find.byType(AccesoFoto));

      expect(foto.fundidoHaciaLado, isTrue);
    });

    testWidgets('título, PIN y botón se ven sin desplazarse', (tester) async {
      await _montar(tester, apaisada: true);
      final textos = textosEn(tester);

      expect(
        _rect(tester, find.text(textos.sesionIngresoTitulo)).bottom,
        lessThanOrEqualTo(tamanoApaisado.height),
      );
      expect(
        _rect(tester, find.byType(CasillasPin)).bottom,
        lessThanOrEqualTo(tamanoApaisado.height),
      );
      expect(
        _rect(tester, _botonIngresar(tester)).bottom,
        lessThanOrEqualTo(tamanoApaisado.height),
      );
      expect(_alcanceDelDesplazamiento(tester), 0);
    });

    testWidgets('el campo del PIN es visible, alcanzable y acepta el PIN', (
      tester,
    ) async {
      await _montar(tester, apaisada: true);

      expect(find.byType(CasillasPin).hitTestable(), findsOneWidget);
      expect(_campoPin.hitTestable(), findsOneWidget);

      await tester.enterText(_campoPin, 'AGR7K2Q');
      await tester.pump();
      expect(_habilitado(tester), isTrue);
    });

    testWidgets('con el teclado abierto, el PIN sigue a la vista', (
      tester,
    ) async {
      await _montar(tester, apaisada: true);

      // Como en el teléfono: se toca el campo y luego sube el teclado.
      await tester.tap(find.byType(CasillasPin));
      await tester.pump();
      tester.view.viewInsets = const FakeViewPadding(bottom: _altoTeclado);
      await tester.pumpAndSettle();
      final sobreTeclado = tamanoApaisado.height - _altoTeclado;

      // La casilla entera queda sobre el teclado, y el botón también.
      final casillas = _rect(tester, find.byType(CasillasPin));
      expect(casillas.top, greaterThanOrEqualTo(0));
      expect(casillas.bottom, lessThanOrEqualTo(sobreTeclado));
      expect(_campoPin.hitTestable(), findsOneWidget);
      expect(tester.widget<TextField>(_campoPin).focusNode?.hasFocus, isTrue);
      expect(
        _rect(tester, _botonIngresar(tester)).bottom,
        lessThanOrEqualTo(sobreTeclado),
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('los demás tamaños conservan su layout', () {
    testWidgets('vertical (393×852): la foto queda arriba y el PIN debajo', (
      tester,
    ) async {
      await _montar(tester, tamano: const Size(393, 852));
      final cabecera = _rect(tester, find.byType(CabeceraFoto));
      final casillas = _rect(tester, find.byType(CasillasPin));

      expect(cabecera.height, 220);
      expect(casillas.top, greaterThanOrEqualTo(cabecera.bottom));
      // En vertical el fundido sigue siendo hacia abajo.
      expect(
        tester.widget<AccesoFoto>(find.byType(AccesoFoto)).fundidoHaciaLado,
        isFalse,
      );
      expect(tester.takeException(), isNull);
    });

    for (final tamano in [const Size(1024, 768), const Size(1280, 800)]) {
      testWidgets(
        'tablet y web (${tamano.width.toInt()}×${tamano.height.toInt()}): '
        'panel de marca a la izquierda y PIN a la derecha',
        (tester) async {
          await _montar(tester, tamano: tamano);
          final panel = _rect(tester, find.byType(PanelDeMarca));
          final casillas = _rect(tester, find.byType(CasillasPin));

          expect(find.byType(CabeceraFoto), findsNothing);
          expect(casillas.left, greaterThanOrEqualTo(panel.right));
          expect(tester.takeException(), isNull);
        },
      );
    }
  });
}

/// Cuánto puede desplazarse el formulario: 0 significa que cabe sin scroll.
double _alcanceDelDesplazamiento(WidgetTester tester) {
  final scroll = find.descendant(
    of: find.byType(PlantillaAuth),
    matching: find.byType(Scrollable),
  );
  return tester.state<ScrollableState>(scroll.first).position.maxScrollExtent;
}
