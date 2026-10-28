import 'dart:async';

/// Cuenta las peticiones de un listado y permite dejarlas en curso o hacerlas
/// fallar, para probar la sincronización (tirar hacia abajo, refresco en
/// segundo plano) sin red.
///
/// Cada repositorio falso de un test lo llama al empezar `listar`: así se ve
/// cuántas peticiones salieron, cuál sigue en curso y cuál falló.
class PedidosFalsos {
  /// Peticiones que salieron (la primera carga cuenta).
  int llamadas = 0;

  /// Si está puesta, la petición espera a que se complete este `Completer`.
  Completer<void>? pausa;

  /// Si está puesto, la petición falla con este error.
  Exception? error;

  Future<void> atender() async {
    llamadas++;
    final espera = pausa;
    if (espera != null) await espera.future;
    final fallo = error;
    if (fallo != null) throw fallo;
  }
}
