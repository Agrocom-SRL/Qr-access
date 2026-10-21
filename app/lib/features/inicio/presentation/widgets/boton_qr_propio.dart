import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Acceso al QR propio de acceso desde la cabecera del inicio (todos los roles
/// con permiso de generar QR, guardia incluido). Va en la cabecera y no en el
/// botón flotante, que es para generar un QR nuevo. El ícono "persona con
/// visto" (autorizado) distingue el QR propio de las entradas del día.
class BotonQrPropio extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton.filledTonal(
      tooltip: context.l10n.inicioQrPropio,
      onPressed: () => context.go(Rutas.qrRapido),
      icon: const Icon(Icons.how_to_reg),
    );
  }
}
