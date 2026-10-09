import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/pintor_qr.dart';
import 'package:flutter/material.dart';

/// Muestra el QR negro sobre blanco, de al menos `qrMinimo` dp, con zona de
/// silencio. No se tematiza (sistema de diseño §1.8): se lee igual en claro
/// y en oscuro.
class VisorQr extends StatelessWidget {
  const new({required this.texto, super.key});

  /// Token del QR (`AQ1.<token>`). Solo lo recibe la pantalla que lo muestra.
  final String texto;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      label: context.l10n.qrVisorEtiqueta,
      image: true,
      child: SizedBox.square(
        dimension: tokens.tamano.qrMinimo,
        child: CustomPaint(
          painter: PintorQr(
            imagen: crearImagenQr(texto),
            zonaSilencioModulos: tokens.tamano.qrZonaSilencioModulos,
            colorModulo: tokens.colores.qrModulo,
            colorFondo: tokens.colores.qrFondo,
          ),
        ),
      ),
    );
  }
}
