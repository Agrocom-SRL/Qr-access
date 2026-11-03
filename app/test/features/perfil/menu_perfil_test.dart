import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/data/perfil_repositorio.dart';
import 'package:agrocom_acceso/features/perfil/perfil.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

Future<void> _montar(
  WidgetTester tester, {
  required Widget pagina,
  Set<String> permisos = const {},
}) async {
  await montarPantalla(
    tester,
    pagina: pagina,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      almacenPreferenciasProvider.overrideWithValue(AlmacenPreferenciasFalso()),
      perfilRepositorioProvider.overrideWithValue(PerfilRepositorioFalso()),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
}

Future<void> _abrirMenu(WidgetTester tester) async {
  await tester.tap(find.byTooltip(textosEn(tester).perfilMenuMas));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sin permisos de gestión, el menú solo ofrece Ajustes', (
    tester,
  ) async {
    await _montar(
      tester,
      pagina: const PerfilPagina(),
      permisos: {Permisos.verQr},
    );
    await _abrirMenu(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.perfilAjustes), findsOneWidget);
    expect(find.text(textos.perfilIncidentes), findsNothing);
    expect(find.text(textos.perfilAperturaManual), findsNothing);
    expect(find.text(textos.perfilSeguridadTitulo), findsNothing);
  });

  testWidgets('el administrador ve todas las opciones del menú', (
    tester,
  ) async {
    await _montar(
      tester,
      pagina: const PerfilPagina(),
      permisos: {
        Permisos.verIncidentes,
        Permisos.configurarAperturaManual,
        Permisos.anularQrDeRama,
        Permisos.exportarDatos,
      },
    );
    await _abrirMenu(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.perfilAjustes), findsOneWidget);
    expect(find.text(textos.perfilIncidentes), findsOneWidget);
    expect(find.text(textos.perfilAperturaManual), findsOneWidget);
    expect(find.text(textos.perfilSeguridadTitulo), findsOneWidget);
  });

  testWidgets('un Titular con incidentes y anulación ve esas dos más Ajustes', (
    tester,
  ) async {
    await _montar(
      tester,
      pagina: const PerfilPagina(),
      permisos: {Permisos.verIncidentes, Permisos.anularQrDeRama},
    );
    await _abrirMenu(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.perfilIncidentes), findsOneWidget);
    expect(find.text(textos.perfilSeguridadTitulo), findsOneWidget);
    expect(find.text(textos.perfilAperturaManual), findsNothing);
  });

  testWidgets('cada opción del menú lleva a su ruta', (tester) async {
    await _montar(
      tester,
      pagina: const PerfilPagina(),
      permisos: {Permisos.verIncidentes},
    );
    await _abrirMenu(tester);
    await tester.tap(find.text(textosEn(tester).perfilIncidentes));
    await tester.pumpAndSettle();

    expect(find.text('destino /incidentes'), findsOneWidget);
  });

  testWidgets('Ajustes reúne idioma, tema, dispositivos y acerca de', (
    tester,
  ) async {
    await _montar(tester, pagina: const AjustesPagina());
    final textos = textosEn(tester);

    expect(find.text(textos.perfilTemaOscuro), findsOneWidget);
    expect(find.text(textos.perfilDispositivos), findsOneWidget);
    expect(find.text(textos.perfilAcercaTitulo), findsOneWidget);

    await tester.tap(find.text(textos.perfilAcercaTitulo));
    await tester.pumpAndSettle();
    expect(find.text(textos.perfilAcercaTerminos), findsOneWidget);
    expect(find.text(textos.perfilAcercaPrivacidad), findsOneWidget);
  });

  testWidgets('Seguridad y datos muestra solo las filas con permiso', (
    tester,
  ) async {
    await _montar(
      tester,
      pagina: const SeguridadPagina(),
      permisos: {Permisos.exportarDatos},
    );
    final textos = textosEn(tester);

    expect(find.text(textos.perfilExportar), findsOneWidget);
    expect(find.text(textos.perfilAnularMiRama), findsNothing);

    await tester.tap(find.text(textos.perfilExportar));
    await tester.pumpAndSettle();
    expect(find.text('destino /exportar'), findsOneWidget);
  });
}
