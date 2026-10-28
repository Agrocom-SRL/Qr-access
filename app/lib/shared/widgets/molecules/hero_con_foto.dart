import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Tarjeta "hero" de marca con una foto de fondo bajo un velo verde.
/// El velo es parejo y alto a propósito: el texto de [child] (`sobreHero`)
/// se lee igual sobre cualquier zona de la foto, que queda como textura.
/// La foto es decorativa: no se anuncia.
class HeroConFoto extends StatelessWidget {
  const new({required this.ruta, required this.child, super.key});

  /// Ruta del asset (ver `Multimedia`).
  final String ruta;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final radio = BorderRadius.circular(tokens.radio.xl);
    return ClipRRect(
      borderRadius: radio,
      child: Stack(
        children: [
          Positioned.fill(
            child: ExcludeSemantics(
              child: Image.asset(ruta, fit: BoxFit.cover),
            ),
          ),
          Positioned.fill(
            child: ColoredBox(
              color: tokens.colores.hero.withValues(alpha: opacidadVeloHero),
            ),
          ),
          Padding(padding: EdgeInsets.all(tokens.espacio.xl), child: child),
        ],
      ),
    );
  }
}
