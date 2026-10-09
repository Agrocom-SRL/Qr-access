import 'package:agrocom_acceso/core/router/guarda_sesion.dart';
import 'package:agrocom_acceso/core/router/paginas_sistema.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/inicio/inicio.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/features/sesion/sesion.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Navegación de la app (ADR 0012). Cada cambio de sesión vuelve a evaluar la
/// guarda de `guarda_sesion.dart`.
final routerProvider = Provider<GoRouter>((ref) {
  final cambiosDeSesion = ValueNotifier<int>(0);
  ref.listen(sesionControladorProvider, (_, _) => cambiosDeSesion.value++);

  final router = GoRouter(
    initialLocation: Rutas.ingreso,
    refreshListenable: cambiosDeSesion,
    redirect: (context, state) => redireccionDeSesion(
      ref.read(sesionControladorProvider),
      state.matchedLocation,
    ),
    errorBuilder: (context, state) => const RutaNoEncontrada(),
    routes: [
      GoRoute(
        path: Rutas.arranque,
        builder: (context, state) => const ArranquePagina(),
      ),
      GoRoute(
        path: Rutas.ingreso,
        builder: (context, state) => const IngresoPagina(),
      ),
      GoRoute(
        path: Rutas.elegirRol,
        builder: (context, state) => const ElegirRolPagina(),
      ),
      GoRoute(
        path: Rutas.inicio,
        builder: (context, state) => const InicioPagina(),
      ),
      GoRoute(
        path: Rutas.qrMios,
        builder: (context, state) => const MisQrPagina(),
      ),
      GoRoute(
        path: Rutas.qrNuevo,
        builder: (context, state) => const EmitirQrPagina(),
      ),
      GoRoute(
        path: Rutas.qrEmitido,
        // Sin el QR en `extra` (p. ej. al recargar la web), no hay nada que
        // mostrar.
        redirect: (context, state) =>
            state.extra is QrEmitido ? null : Rutas.qrMios,
        builder: (context, state) =>
            MostrarQrPagina(qr: state.extra! as QrEmitido),
      ),
      GoRoute(
        path: Rutas.eventos,
        builder: (context, state) => const EventosPagina(),
      ),
    ],
  );
  ref.onDispose(() {
    router.dispose();
    cambiosDeSesion.dispose();
  });
  return router;
});
