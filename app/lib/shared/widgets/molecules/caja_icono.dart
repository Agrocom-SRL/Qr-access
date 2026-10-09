import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Ícono dentro de un cuadrado de fondo suave y radio 10 (filas de listado,
/// accesos rápidos e indicadores).
class CajaIcono extends StatelessWidget {
  const new({
    required this.icono,
    this.tono = TonoCaja.primario,
    this.tamano,
    super.key,
  });

  final IconData icono;
  final TonoCaja tono;
  final double? tamano;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final lado = tamano ?? tokens.tamano.iconoCaja;
    final (fondo, color) = switch (tono) {
      TonoCaja.primario => (colores.primarioSuave, colores.primario),
      TonoCaja.peligro => (colores.peligroSuave, colores.peligro),
      TonoCaja.advertencia => (colores.advertenciaSuave, colores.advertencia),
      TonoCaja.informacion => (colores.informacionSuave, colores.informacion),
      TonoCaja.neutro => (colores.fondo, colores.textoSecundario),
      TonoCaja.hero => (colores.heroAcento, colores.sobreHero),
      TonoCaja.superficie => (colores.superficie, colores.primario),
    };
    return Container(
      width: lado,
      height: lado,
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(
          lado >= tokens.tamano.accesoRapido ? tokens.radio.l : tokens.radio.m,
        ),
        boxShadow: tono == TonoCaja.superficie ? colores.elev1 : null,
      ),
      child: Icon(icono, color: color, size: lado / 2),
    );
  }
}

enum TonoCaja {
  primario,
  peligro,
  advertencia,
  informacion,
  neutro,
  hero,
  superficie,
}
