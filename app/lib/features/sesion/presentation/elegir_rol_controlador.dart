import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Estado de la pantalla de elegir rol. Inmutable.
@immutable
class ElegirRolEstado {
  const new({this.enviando = false, this.errorApi});

  final bool enviando;
  final ErrorApi? errorApi;
}

/// Controlador de la pantalla de elegir rol (ADR 0004: un rol activo por
/// sesión).
class ElegirRolControlador extends Notifier<ElegirRolEstado> {
  @override
  ElegirRolEstado build() => const ElegirRolEstado();

  /// Activa `rolId`. Si falla, el usuario sigue en la pantalla y ve el error.
  Future<void> elegir(String rolId) async {
    if (state.enviando) return;
    state = const ElegirRolEstado(enviando: true);
    try {
      await ref.read(sesionControladorProvider.notifier).elegirRol(rolId);
    } on ErrorApi catch (error) {
      state = ElegirRolEstado(errorApi: error);
    }
  }

  /// Sale de la sesión sin elegir rol.
  Future<void> cerrar() =>
      ref.read(sesionControladorProvider.notifier).cerrar();
}

final NotifierProvider<ElegirRolControlador, ElegirRolEstado>
elegirRolControladorProvider =
    NotifierProvider.autoDispose<ElegirRolControlador, ElegirRolEstado>(
      ElegirRolControlador.new,
    );
