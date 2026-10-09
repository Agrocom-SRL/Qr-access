import 'package:agrocom_acceso/features/sesion/sesion.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

abstract final class Rutas {
  static const ingreso = '/ingreso';
}

/// Navegación de la app. Las guardas por sesión y permiso llegan con la HU-04.
final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: Rutas.ingreso,
    routes: [
      GoRoute(
        path: Rutas.ingreso,
        builder: (context, state) => const IngresoPagina(),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
