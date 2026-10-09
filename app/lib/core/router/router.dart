import 'package:agrocom_acceso/core/router/guarda_sesion.dart';
import 'package:agrocom_acceso/core/router/paginas_sistema.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/router/transiciones.dart';
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
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const ArranquePagina()),
      ),
      GoRoute(
        path: Rutas.bienvenida,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const BienvenidaPagina()),
      ),
      GoRoute(
        path: Rutas.ingreso,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const IngresoPagina()),
      ),
      GoRoute(
        path: Rutas.elegirRol,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const ElegirRolPagina()),
      ),
      GoRoute(
        path: Rutas.inicio,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const InicioPagina()),
      ),
      GoRoute(
        path: Rutas.qrMios,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const MisQrPagina()),
      ),
      GoRoute(
        path: Rutas.qrNuevo,
        pageBuilder: (context, state) => paginaAnimada(
          context,
          state,
          EmitirQrPagina(
            prellenado: state.extra is PrellenadoEmision
                ? state.extra! as PrellenadoEmision
                : null,
          ),
          transicion: Transicion.flujo,
        ),
      ),
      GoRoute(
        path: Rutas.qrEmitido,
        // Sin el QR en `extra` (p. ej. al recargar la web), no hay nada que
        // mostrar.
        redirect: (context, state) =>
            state.extra is QrEmitido ? null : Rutas.qrMios,
        pageBuilder: (context, state) => paginaAnimada(
          context,
          state,
          MostrarQrPagina(qr: state.extra! as QrEmitido),
          transicion: Transicion.flujo,
        ),
      ),
      GoRoute(
        path: Rutas.eventos,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const EventosPagina()),
      ),
      GoRoute(
        path: Rutas.perfil,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const PerfilPagina()),
      ),
      GoRoute(
        path: Rutas.admin,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const AdministracionPagina()),
      ),
      GoRoute(
        path: Rutas.adminPuertas,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const PuertasAdminPagina()),
      ),
      GoRoute(
        path: Rutas.adminUsuarios,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const UsuariosPagina()),
        routes: [
          GoRoute(
            path: 'nuevo',
            pageBuilder: (context, state) => paginaAnimada(
              context,
              state,
              const UsuarioFormularioPagina(),
              transicion: Transicion.flujo,
            ),
          ),
          GoRoute(
            path: 'pin',
            redirect: (context, state) =>
                state.extra is PinGenerado ? null : Rutas.adminUsuarios,
            pageBuilder: (context, state) => paginaAnimada(
              context,
              state,
              PinGeneradoPagina(pin: state.extra! as PinGenerado),
              transicion: Transicion.flujo,
            ),
          ),
          GoRoute(
            path: ':id',
            pageBuilder: (context, state) => paginaAnimada(
              context,
              state,
              UsuarioFormularioPagina(usuarioId: state.pathParameters['id']),
              transicion: Transicion.flujo,
            ),
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
