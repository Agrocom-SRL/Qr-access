import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Monta `pagina` con el tema, los textos y el router reales, y los overrides
/// de Riverpod que pase el test. Las rutas que la página puede abrir muestran
/// su propia dirección, así un test verifica a dónde navega.
Future<void> montarPantalla(
  WidgetTester tester, {
  required Widget pagina,
  List<Override> overrides = const [],
  ThemeData? tema,
  String ruta = '/',
}) async {
  final router = GoRouter(
    initialLocation: ruta,
    routes: [
      GoRoute(path: '/', builder: (context, state) => pagina),
      for (final destino in [
        Rutas.arranque,
        Rutas.ingreso,
        Rutas.elegirRol,
        Rutas.inicio,
        Rutas.qrMios,
        Rutas.qrNuevo,
        Rutas.eventos,
      ])
        GoRoute(
          path: destino,
          builder: (context, state) => Text('destino $destino'),
        ),
      GoRoute(
        path: Rutas.qrEmitido,
        builder: (context, state) => const Text('destino ${Rutas.qrEmitido}'),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        theme: tema ?? Tema.claro,
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
