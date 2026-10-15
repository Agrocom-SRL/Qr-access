import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Confirmación grande en el lugar del QR cuando la puerta lo aceptó: el QR
/// ya cumplió su único uso (invariante 3), no hay nada más que acercar.
class QrConcedido extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return SizedBox(
      height: tokens.tamano.qrExpandido,
      child: Center(
        child: Icon(
          Icons.check_circle,
          size: tokens.tamano.qrExpandido / 2,
          color: tokens.colores.primario,
        ),
      ),
    );
  }
}
