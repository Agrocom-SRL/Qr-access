import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:animations/animations.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Cómo se anima el paso de una pantalla a otra (paquete `animations`, de
/// Google, con las transiciones de Material).
enum Transicion {
  /// Entre destinos del mismo nivel (Inicio, Eventos, Perfil…): la saliente
  /// se desvanece y la entrante aparece.
  mismoNivel,

  /// Hacia adelante en un flujo (emitir, QR emitido, formularios): las dos se
  /// desplazan en el eje horizontal.
  flujo,
}

/// Página de go_router con la transición elegida. Dura lo que dice el token
/// de movimiento y se anula con "reducir movimiento".
CustomTransitionPage<void> paginaAnimada(
  BuildContext context,
  GoRouterState state,
  Widget child, {
  Transicion transicion = Transicion.mismoNivel,
}) {
  final duracion = context.tokens.duracion.efectiva(
    context,
    context.tokens.duracion.lenta,
  );
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: duracion,
    reverseTransitionDuration: duracion,
    transitionsBuilder: (context, animation, secundaria, hijo) =>
        switch (transicion) {
          Transicion.mismoNivel => FadeThroughTransition(
            animation: animation,
            secondaryAnimation: secundaria,
            child: hijo,
          ),
          Transicion.flujo => SharedAxisTransition(
            animation: animation,
            secondaryAnimation: secundaria,
            transitionType: SharedAxisTransitionType.horizontal,
            child: hijo,
          ),
        },
  );
}
