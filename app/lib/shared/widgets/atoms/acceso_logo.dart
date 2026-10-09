import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Logo de AGROCOM (`assets/imagenes/logo_agrocom.png`) sobre una placa
/// blanca con radio 20 (10 en tamaños chicos). La placa va siempre en
/// superficie clara, también en oscuro y sobre el hero: el logo es verde y
/// naranja sobre fondo transparente, y solo se lee bien sobre blanco.
class AccesoLogo extends StatelessWidget {
  const new({this.tamano, this.sobreHero = false, super.key});

  /// Alto de la placa; el ancho sale de la proporción del logo.
  final double? tamano;

  /// Sobre el hero verde la placa no lleva sombra (ya contrasta).
  final bool sobreHero;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final alto = tamano ?? tokens.tamano.logo;
    final grande = alto >= tokens.tamano.logo;
    return ExcludeSemantics(
      child: Container(
        width: alto * tokens.tamano.logoProporcion,
        height: alto,
        padding: EdgeInsets.all(grande ? tokens.espacio.s : tokens.espacio.xs),
        decoration: BoxDecoration(
          color: colores.placaLogo,
          borderRadius: BorderRadius.circular(
            grande ? tokens.radio.xl : tokens.radio.m,
          ),
          boxShadow: sobreHero ? null : colores.elev1,
        ),
        child: Image.asset(
          'assets/imagenes/logo_agrocom.png',
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
