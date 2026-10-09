import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Estado de la pantalla de ingreso. Inmutable.
@immutable
class IngresoEstado {
  const new({
    this.enviando = false,
    this.pinInvalido = false,
    this.errorApi,
    this.bloqueadoHasta,
  });

  final bool enviando;

  /// El texto no tiene el formato del PIN: no se envía a la API.
  final bool pinInvalido;

  /// Fallo devuelto por la API, ya leído (se traduce en la pantalla).
  final ErrorApi? errorApi;

  /// Hasta cuándo dura el bloqueo por demasiados intentos (C02d).
  final DateTime? bloqueadoHasta;

  /// "PIN incorrecto": el único error que pinta las casillas en peligro.
  bool get pinIncorrecto =>
      pinInvalido || errorApi?.code == 'sesion.credenciales_invalidas';

  bool bloqueadoEn(DateTime ahora) =>
      bloqueadoHasta != null && bloqueadoHasta!.isAfter(ahora);
}

/// Controlador de la pantalla de ingreso (ADR 0019): valida el formato, envía
/// el PIN y entrega la respuesta a la sesión. No habla con dio.
class IngresoControlador extends Notifier<IngresoEstado> {
  @override
  IngresoEstado build() => const IngresoEstado();

  /// Envía `entrada` (el PIN tal como lo escribió la persona).
  Future<void> ingresar(String entrada) async {
    if (state.enviando) return;
    final pin = Pin.desde(entrada);
    if (pin == null) {
      state = const IngresoEstado(pinInvalido: true);
      return;
    }
    state = const IngresoEstado(enviando: true);
    try {
      final inicio = await ref.read(sesionRepositorioProvider).iniciar(pin);
      await ref.read(sesionControladorProvider.notifier).adoptarInicio(inicio);
      state = const IngresoEstado();
    } on ErrorApi catch (error) {
      state = IngresoEstado(errorApi: error, bloqueadoHasta: _bloqueoDe(error));
    }
  }

  /// Al corregir el PIN, el error anterior deja de mostrarse.
  void limpiarError() {
    if (state.errorApi == null && !state.pinInvalido) return;
    state = IngresoEstado(bloqueadoHasta: state.bloqueadoHasta);
  }

  /// Se pasó el tiempo del bloqueo: se puede intentar de nuevo.
  void levantarBloqueo() {
    if (state.bloqueadoHasta == null) return;
    state = const IngresoEstado();
  }

  DateTime? _bloqueoDe(ErrorApi error) {
    if (error.code != 'sesion.bloqueada') return null;
    final segundos = error.reintentarEnSegundos ?? segundosDeBloqueoPorDefecto;
    return ref.read(relojProvider)().add(Duration(seconds: segundos));
  }
}

/// Si la API no dice cuánto esperar, se asume el bloqueo base del servidor.
const segundosDeBloqueoPorDefecto = 60;

/// Se descarta al salir de la pantalla: un error viejo no vuelve al reingresar.
final NotifierProvider<IngresoControlador, IngresoEstado>
ingresoControladorProvider =
    NotifierProvider.autoDispose<IngresoControlador, IngresoEstado>(
      IngresoControlador.new,
    );
