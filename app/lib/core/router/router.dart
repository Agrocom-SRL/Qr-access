import 'package:agrocom_acceso/core/router/guarda_sesion.dart';
import 'package:agrocom_acceso/core/router/paginas_sistema.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/inicio/inicio.dart';
import 'package:agrocom_acceso/features/perfil/perfil.dart';
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
    initialLocation: Rutas.bienvenida,
    refreshListenable: cambiosDeSesion,
    redirect: (context, state) => redireccionDeSesion(
      ref.read(sesionControladorProvider),
      state.topRoute?.path ?? state.matchedLocation,
    ),
    errorBuilder: (context, state) => const RutaNoEncontrada(),
    routes: [
      GoRoute(
        path: Rutas.arranque,
        builder: (context, state) => const ArranquePagina(),
      ),
      GoRoute(
        path: Rutas.bienvenida,
        builder: (context, state) => const BienvenidaPagina(),
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
        builder: (context, state) => EmitirQrPagina(
          prellenado: state.extra is PrellenadoEmision
              ? state.extra! as PrellenadoEmision
              : null,
        ),
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
      GoRoute(
        path: Rutas.perfil,
        builder: (context, state) => const PerfilPagina(),
      ),
      GoRoute(
        path: Rutas.admin,
        builder: (context, state) => const AdministracionPagina(),
      ),
      GoRoute(
        path: Rutas.adminPuertas,
        builder: (context, state) => const PuertasAdminPagina(),
      ),
      GoRoute(
        path: Rutas.adminUsuarios,
        builder: (context, state) => const UsuariosPagina(),
        routes: [
          GoRoute(
            path: 'nuevo',
            builder: (context, state) => const UsuarioFormularioPagina(),
          ),
          GoRoute(
            path: 'pin',
            redirect: (context, state) =>
                state.extra is PinGenerado ? null : Rutas.adminUsuarios,
            builder: (context, state) =>
                PinGeneradoPagina(pin: state.extra! as PinGenerado),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                UsuarioFormularioPagina(usuarioId: state.pathParameters['id']),
          ),
        ],
      ),
    ],
  );
  ref.onDispose(() {
    router.dispose();
    cambiosDeSesion.dispose();
  });
  return router;
});
