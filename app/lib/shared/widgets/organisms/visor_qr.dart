import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/qr/pintor_qr.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Muestra el QR negro sobre blanco, de 240 dp (320 en expandido) más 16 dp
/// de zona de silencio. No se tematiza (handoff §QR): se lee igual en claro y
/// en oscuro.
class VisorQr extends StatelessWidget {
  const new({required this.texto, super.key});

  /// Token del QR (`AQ1.<token>`). Solo lo recibe la pantalla que lo muestra.
  final String texto;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final lado = context.esExpandida
        ? tokens.tamano.qrExpandido
        : tokens.tamano.qrMinimo;
    return Semantics(
      label: context.l10n.qrVisorEtiqueta,
      image: true,
      child: Container(
        padding: EdgeInsets.all(tokens.tamano.qrZonaSilencio),
        decoration: BoxDecoration(
          color: tokens.colores.qrFondo,
          borderRadius: BorderRadius.circular(tokens.radio.xl),
          boxShadow: tokens.colores.elev1,
        ),
        child: SizedBox.square(
          dimension: lado,
          child: CustomPaint(
            painter: PintorQr(
              imagen: crearImagenQr(texto),
              zonaSilencioModulos: tokens.tamano.qrZonaSilencioModulos,
              colorModulo: tokens.colores.qrModulo,
              colorFondo: tokens.colores.qrFondo,
            ),
          ),
        ),
      ),
    );
  }
}
