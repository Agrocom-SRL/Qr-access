import 'dart:async';

import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/splash_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lottie/lottie.dart';

/// Splash animado tras el nativo: el mismo degradado verde y la misma placa
/// con el logo a color, con anillos (Lottie `splash_logo`) que se expanden
/// detrás y el nombre de la app que aparece debajo. Dura ≤ 800 ms
/// (`Duraciones.splash`).
///
/// Mientras suena la animación, `SesionControlador` ya está leyendo el
/// refresco guardado en `flutter_secure_storage`. Al terminar se marca
/// [splashTerminadoProvider] y la guarda de sesión del router lleva a
/// `/bienvenida` o `/inicio` (go_router). Con "reducir movimiento" se muestra
/// el logo estático y se libera de inmediato.
class SplashPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<SplashPagina> createState() => _SplashPaginaEstado();
}

class _SplashPaginaEstado extends ConsumerState<SplashPagina>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controlador = AnimationController(vsync: this)
    ..addStatusListener((estado) {
      if (estado == AnimationStatus.completed) _terminar();
    });
  var _iniciado = false;

  void _terminar() {
    if (mounted) ref.read(splashTerminadoProvider.notifier).terminar();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iniciado) return;
    _iniciado = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      // No se puede cambiar el estado de un provider durante el build.
      unawaited(Future.microtask(_terminar));
      return;
    }
    _controlador.duration = context.tokens.duracion.splash;
    _controlador.forward();
  }

  @override
  void dispose() {
    _controlador.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final estatico = MediaQuery.disableAnimationsOf(context);
    final oscuro = Theme.of(context).brightness == Brightness.dark;
    final lienzo = tokens.tamano.splash;
    final placa = Image.asset(
      Multimedia.logoPlaca,
      width: tokens.tamano.splashLogo,
      fit: BoxFit.contain,
    );
    final nombre = Text(
      context.l10n.appTitulo,
      style: Theme.of(context).textTheme.titleLarge
          ?.copyWith(color: tokens.colores.sobreHero, letterSpacing: 1),
    );
    final curva = CurvedAnimation(
      parent: _controlador,
      curve: tokens.duracion.curva,
    );
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            oscuro ? Multimedia.fondoSplashOscuro : Multimedia.fondoSplash,
            fit: BoxFit.cover,
          ),
          // Decorativo: el nombre de la app ya lo anuncia el sistema.
          ExcludeSemantics(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox.square(
                    dimension: lienzo,
                    child: estatico
                        ? Center(child: placa)
                        : Stack(
                            alignment: Alignment.center,
                            children: [
                              Lottie.asset(
                                Multimedia.lottieSplash,
                                controller: _controlador,
                                width: lienzo,
                                height: lienzo,
                                // Sin el Lottie queda la placa sola.
                                errorBuilder: (_, _, _) =>
                                    const SizedBox.shrink(),
                              ),
                              ScaleTransition(
                                scale: Tween<double>(
                                  begin: 0.82,
                                  end: 1,
                                ).animate(curva),
                                child: FadeTransition(
                                  opacity: curva,
                                  child: placa,
                                ),
                              ),
                            ],
                          ),
                  ),
                  SizedBox(height: tokens.espacio.l),
                  if (estatico)
                    nombre
                  else
                    FadeTransition(opacity: curva, child: nombre),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
