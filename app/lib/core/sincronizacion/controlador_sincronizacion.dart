import 'dart:async';

import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/sincronizacion/estado_sincronizacion.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Sincronización de un listado: lo pide de nuevo a mano (tirando hacia
/// abajo) y en segundo plano mientras la pantalla está abierta y la app en
/// primer plano.
///
/// Cada feature extiende esta clase y dice cómo recargar SU listado en
/// [recargarListado]; aquí viven las reglas (cuándo se pide, cuántas a la vez,
/// qué estado se publica). La pantalla solo lo pinta.
///
/// Reglas (limites-y-abuso):
/// - Una petición a la vez: si hay una en curso, no se lanza otra.
/// - Sin sesión, el refresco automático no pide nada (el manual sí, porque lo
///   pidió la persona).
/// - Se detiene al ir a segundo plano y, al volver, pide una vez y reanuda el
///   intervalo. Al salir de la pantalla, el provider `autoDispose` lo cancela.
/// - Los datos de una caché sin conexión no cuentan como "actualizado": se
///   publica `sinConexion` y la hora de la última respuesta viva no cambia.
abstract class ControladorSincronizacion
    extends Notifier<EstadoSincronizacion> {
  /// Vuelve a pedir el listado a la API y termina cuando llegaron sus datos.
  /// Lanza [ErrorApi] si la petición falla.
  Future<void> recargarListado();

  @override
  EstadoSincronizacion build() {
    final ciclo = AppLifecycleListener(
      onShow: _alVolverAPrimerPlano,
      onHide: _detenerTemporizador,
    );
    ref.onDispose(() {
      _detenerTemporizador();
      ciclo.dispose();
    });
    _iniciarTemporizador();
    return EstadoSincronizacion(ultimaActualizacion: ref.read(relojProvider)());
  }

  Timer? _temporizador;

  /// Pide el listado si no hay otra petición en curso. Nunca lanza: el error
  /// de la lista lo muestra la propia pantalla; aquí solo queda el estado.
  Future<void> refrescar() async {
    if (state.actualizando) return;
    state = state.copiar(actualizando: true);
    var sinConexion = false;
    var ultimaActualizacion = state.ultimaActualizacion;
    try {
      await recargarListado();
      if (!ref.mounted) return;
      // La caché del cliente responde sin error cuando no hay red; por eso se
      // mira si lo que llegó es de la caché y no de la API.
      sinConexion = ref.read(datosGuardadosProvider) != null;
      if (!sinConexion) ultimaActualizacion = ref.read(relojProvider)();
    } on ErrorApi catch (error) {
      sinConexion = error.esSinConexion;
    } finally {
      if (ref.mounted) {
        state = EstadoSincronizacion(
          ultimaActualizacion: ultimaActualizacion,
          sinConexion: sinConexion,
        );
      }
    }
  }

  void _iniciarTemporizador() {
    _temporizador?.cancel();
    _temporizador = Timer.periodic(
      const Duraciones().refrescoListado,
      (_) => _refrescarEnSegundoPlano(),
    );
  }

  void _detenerTemporizador() {
    _temporizador?.cancel();
    _temporizador = null;
  }

  void _alVolverAPrimerPlano() {
    _iniciarTemporizador();
    _refrescarEnSegundoPlano();
  }

  /// Sin sesión no hay nada que pedir: la API respondería 401 y la caché no
  /// tiene de quién guardar.
  void _refrescarEnSegundoPlano() {
    if (ref.read(sesionControladorProvider) is! SesionAutenticada) return;
    unawaited(refrescar());
  }
}
