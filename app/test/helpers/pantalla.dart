import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Tamaños de pantalla del handoff: compacto 360×800 y expandido 1440×900.
const tamanoCompacto = Size(360, 800);
const tamanoExpandido = Size(1440, 900);

/// Fija el tamaño de la ventana del test (y lo restaura al terminar).
void usarTamano(WidgetTester tester, Size tamano) {
  tester.view
    ..physicalSize = tamano
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

/// Monta `pagina` con el tema, los textos y el router reales, y los overrides
/// de Riverpod que pase el test. Las rutas que la página puede abrir muestran
/// su propia dirección, así un test verifica a dónde navega. Por defecto se
/// monta en compacto (360×800); con [expandida], en 1440×900.
Future<void> montarPantalla(
  WidgetTester tester, {
  required Widget pagina,
  List<Override> overrides = const [],
  ThemeData? tema,
  String ruta = '/',
  bool expandida = false,
}) async {
  usarTamano(tester, expandida ? tamanoExpandido : tamanoCompacto);
  final router = GoRouter(
    initialLocation: ruta,
    routes: [
      GoRoute(path: '/', builder: (context, state) => pagina),
      for (final destino in [
        Rutas.arranque,
        Rutas.bienvenida,
        Rutas.ingreso,
        Rutas.elegirRol,
        Rutas.inicio,
        Rutas.qrMios,
        Rutas.qrNuevo,
        Rutas.eventos,
        Rutas.perfil,
        Rutas.admin,
        Rutas.adminPuertas,
        Rutas.adminUsuarios,
        Rutas.adminUsuarioNuevo,
        Rutas.adminUsuarioEditar,
      ])
        GoRoute(
          path: destino,
          builder: (context, state) =>
              Scaffold(body: Text('destino ${state.matchedLocation}')),
        ),
      GoRoute(
        path: Rutas.qrEmitido,
        builder: (context, state) =>
            const Scaffold(body: Text('destino ${Rutas.qrEmitido}')),
      ),
      GoRoute(
        path: Rutas.adminPinGenerado,
        builder: (context, state) =>
            const Scaffold(body: Text('destino ${Rutas.adminPinGenerado}')),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        theme: tema ?? Tema.claro,
        // Los tests comparan contra los textos en español.
        locale: const Locale('es'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
}

/// Textos de la app para comparar en los tests, en el idioma del ARB.
Future<AppLocalizations> textosDe() =>
    AppLocalizations.delegate.load(const Locale('es'));

/// Los textos ya cargados en la pantalla montada.
AppLocalizations textosEn(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));
