import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Acceso a "Abrir puerta" desde la cabecera del inicio (ADR 0035): abre una
/// puerta de la cuenta sin QR, por ejemplo para salir donde no hay lector.
/// Todos los roles de la cuenta lo tienen, como su QR propio.
class BotonAbrirPuerta extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton.filledTonal(
      tooltip: context.l10n.inicioAbrirPuerta,
      onPressed: () => context.go(Rutas.abrirPuerta),
      icon: const Icon(Icons.lock_open),
    );
  }
}
