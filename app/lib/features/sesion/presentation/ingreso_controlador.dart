import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Estado de la pantalla de ingreso. Inmutable.
@immutable
class IngresoEstado {
  const new({this.enviando = false, this.pinInvalido = false, this.errorApi});

  final bool enviando;

  /// El texto no tiene el formato del PIN: no se envía a la API.
  final bool pinInvalido;

  /// Fallo devuelto por la API, ya leído (se traduce en la pantalla).
  final ErrorApi? errorApi;
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
      state = IngresoEstado(errorApi: error);
    }
  }
}

/// Se descarta al salir de la pantalla: un error viejo no vuelve al reingresar.
final NotifierProvider<IngresoControlador, IngresoEstado>
ingresoControladorProvider =
    NotifierProvider.autoDispose<IngresoControlador, IngresoEstado>(
      IngresoControlador.new,
    );
