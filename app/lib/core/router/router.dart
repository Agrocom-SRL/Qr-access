import 'package:agrocom_acceso/core/router/guarda_sesion.dart';
import 'package:agrocom_acceso/core/router/paginas_sistema.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/router/splash_estado.dart';
import 'package:agrocom_acceso/core/router/transiciones.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/dispositivos/dispositivos.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:agrocom_acceso/features/incidentes/incidentes.dart';
import 'package:agrocom_acceso/features/inicio/inicio.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
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
  ref
    ..listen(sesionControladorProvider, (_, _) => cambiosDeSesion.value++)
    ..listen(splashTerminadoProvider, (_, _) => cambiosDeSesion.value++);

  final router = GoRouter(
    initialLocation: Rutas.bienvenida,
    refreshListenable: cambiosDeSesion,
    redirect: (context, state) => redireccionDeSesion(
      ref.read(sesionControladorProvider),
      state.topRoute?.path ?? state.matchedLocation,
      splashTerminado: ref.read(splashTerminadoProvider),
    ),
    errorBuilder: (context, state) => const RutaNoEncontrada(),
    routes: [
      GoRoute(
        path: Rutas.arranque,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const SplashPagina()),
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
          GenerarQrPagina(
            prellenado: state.extra is PrellenadoGeneracion
                ? state.extra! as PrellenadoGeneracion
                : null,
          ),
          transicion: Transicion.flujo,
        ),
      ),
      GoRoute(
        path: Rutas.qrGenerado,
        // Sin el QR en `extra` (p. ej. al recargar la web), no hay nada que
        // mostrar.
        redirect: (context, state) =>
            state.extra is QrGenerado ? null : Rutas.qrMios,
        pageBuilder: (context, state) => paginaAnimada(
          context,
          state,
          MostrarQrPagina(qr: state.extra! as QrGenerado),
          transicion: Transicion.flujo,
        ),
      ),
      GoRoute(
        path: Rutas.qrRapido,
        pageBuilder: (context, state) => paginaAnimada(
          context,
          state,
          const QrRapidoPagina(),
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
        path: Rutas.dispositivos,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const DispositivosPagina()),
      ),
      GoRoute(
        path: Rutas.notificaciones,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const NotificacionesPagina()),
      ),
      GoRoute(
        path: Rutas.incidentes,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const IncidentesPagina()),
        routes: [
          GoRoute(
            path: ':id',
            pageBuilder: (context, state) => paginaAnimada(
              context,
              state,
              IncidenteDetallePagina(id: state.pathParameters['id']!),
              transicion: Transicion.flujo,
            ),
          ),
        ],
      ),
      GoRoute(
        path: Rutas.exportar,
        pageBuilder: (context, state) => paginaAnimada(
          context,
          state,
          const ExportacionPagina(),
          transicion: Transicion.flujo,
        ),
        routes: [
          GoRoute(
            path: 'accesos',
            pageBuilder: (context, state) => paginaAnimada(
              context,
              state,
              const ExportarAccesosPagina(),
              transicion: Transicion.flujo,
            ),
          ),
        ],
      ),
      GoRoute(
        path: Rutas.anularQrDeRama,
        pageBuilder: (context, state) => paginaAnimada(
          context,
          state,
          const AnularQrPagina(),
          transicion: Transicion.flujo,
        ),
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
        path: Rutas.adminEstructura,
        pageBuilder: (context, state) =>
            paginaAnimada(context, state, const EstructuraPagina()),
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
            path: 'estadisticas',
            pageBuilder: (context, state) => paginaAnimada(
              context,
              state,
              const EstadisticasUsuariosPagina(),
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
