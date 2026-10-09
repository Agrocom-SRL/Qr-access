import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Logo de AGROCOM (`assets/imagenes/logo_agrocom.png`) en un cuadrado.
///
/// El PNG es apaisado y transparente: se escala para caber entero y queda
/// centrado en el eje corto (si es más ancho que alto, se centra en vertical).
/// Sin placa, para que no se note un fondo blanco en el tema oscuro; solo
/// sobre el hero verde ([sobreHero]) lleva una placa blanca, porque ahí el
/// logo verde y naranja no contrasta.
class AccesoLogo extends StatelessWidget {
  const new({this.tamano, this.sobreHero = false, super.key});

  /// Lado del cuadrado.
  final double? tamano;

  /// Sobre el hero verde el logo va sobre una placa blanca.
  final bool sobreHero;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final lado = tamano ?? tokens.tamano.logo;
    final grande = lado >= tokens.tamano.logo;
    final imagen = Image.asset(
      'assets/imagenes/logo_agrocom.png',
      fit: BoxFit.contain,
    );
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: lado,
        child: sobreHero
            ? DecoratedBox(
                decoration: BoxDecoration(
                  color: tokens.colores.placaLogo,
                  borderRadius: BorderRadius.circular(
                    grande ? tokens.radio.xl : tokens.radio.m,
                  ),
                ),
                child: Padding(
                  padding: EdgeInsets.all(
                    grande ? tokens.espacio.s : tokens.espacio.xs,
                  ),
                  child: imagen,
                ),
              )
            : imagen,
      ),
    );
  }
}
