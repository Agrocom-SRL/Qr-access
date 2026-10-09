import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Si el splash animado ya terminó en este arranque. La guarda de sesión no
/// deja salir de `arranque` hasta que sea verdadero, así la animación se ve
/// completa aunque la sesión se restaure al instante. Solo se marca una vez.
final splashTerminadoProvider = NotifierProvider<SplashTerminado, bool>(
  SplashTerminado.new,
);

class SplashTerminado extends Notifier<bool> {
  @override
  bool build() => false;

  void terminar() => state = true;
}
