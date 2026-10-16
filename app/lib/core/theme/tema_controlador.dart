import 'dart:async';

import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Clave con la que se guarda el tema elegido.
const clavePreferenciaTema = 'tema';

/// Tema claro, oscuro o el del sistema (Perfil › "Tema oscuro"). Sigue al
/// sistema mientras la persona no lo cambie, y recuerda lo elegido.
class TemaControlador extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    unawaited(_restaurar());
    return ThemeMode.system;
  }

  Future<void> _restaurar() async {
    final guardado = await ref
        .read(almacenPreferenciasProvider)
        .leer(clavePreferenciaTema);
    final modo = ThemeMode.values.where((m) => m.name == guardado).firstOrNull;
    if (modo != null) state = modo;
  }

  Future<void> elegir(ThemeMode modo) async {
    state = modo;
    await ref
        .read(almacenPreferenciasProvider)
        .guardar(clavePreferenciaTema, modo.name);
  }

  /// El interruptor de Perfil: encendido = oscuro, apagado = claro.
  Future<void> activarOscuro({required bool oscuro}) =>
      elegir(oscuro ? ThemeMode.dark : ThemeMode.light);
}

final NotifierProvider<TemaControlador, ThemeMode> temaProvider =
    NotifierProvider<TemaControlador, ThemeMode>(TemaControlador.new);
