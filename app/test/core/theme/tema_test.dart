import 'dart:math' as math;

import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

double _luminancia(Color c) {
  double canal(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
}

double contraste(Color a, Color b) {
  final (la, lb) = (_luminancia(a), _luminancia(b));
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// Contraste AA (≥ 4.5) de los pares de texto del handoff ("texto sobre su
/// fondo suave ≥ 4.5:1"; en oscuro, primario lleva verde900, no blanco).
void main() {
  for (final (nombre, c) in [
    ('claro', ColoresSemanticos.claro),
    ('oscuro', ColoresSemanticos.oscuro),
  ]) {
    group('tema $nombre', () {
      final pares = {
        'texto/superficie': (c.texto, c.superficie),
        'texto/fondo': (c.texto, c.fondo),
        'texto/superficieElevada': (c.texto, c.superficieElevada),
        'textoSecundario/superficie': (c.textoSecundario, c.superficie),
        'sobrePrimario/primario': (c.sobrePrimario, c.primario),
        'sobrePrimario/primarioHover': (c.sobrePrimario, c.primarioHover),
        'sobreHero/hero': (c.sobreHero, c.hero),
        'sobreHero/heroAcento': (c.sobreHero, c.heroAcento),
        'primario/primarioSuave': (c.primario, c.primarioSuave),
        'peligro/superficie': (c.peligro, c.superficie),
        'peligro/peligroSuave': (c.peligro, c.peligroSuave),
        'advertencia/superficie': (c.advertencia, c.superficie),
        'advertencia/advertenciaSuave': (c.advertencia, c.advertenciaSuave),
        'informacion/superficie': (c.informacion, c.superficie),
        'informacion/informacionSuave': (c.informacion, c.informacionSuave),
        'qrModulo/qrFondo': (c.qrModulo, c.qrFondo),
      };
      for (final MapEntry(key: par, value: (a, b)) in pares.entries) {
        test('$par cumple AA', () {
          expect(contraste(a, b), greaterThanOrEqualTo(4.5));
        });
      }
    });
  }

  test('el QR no se tematiza: negro sobre blanco en los dos temas', () {
    for (final c in [ColoresSemanticos.claro, ColoresSemanticos.oscuro]) {
      expect(c.qrModulo, const Color(0xFF000000));
      expect(c.qrFondo, const Color(0xFFFFFFFF));
    }
  });

  test('en oscuro no hay sombra: la elevación es la superficie', () {
    expect(ColoresSemanticos.oscuro.elev1, isEmpty);
    expect(ColoresSemanticos.oscuro.elev3, isEmpty);
    expect(ColoresSemanticos.claro.elev1, isNotEmpty);
  });

  test('los dos temas usan IBM Plex Sans y exponen los tokens', () {
    for (final tema in [Tema.claro, Tema.oscuro]) {
      expect(tema.textTheme.bodyLarge?.fontFamily, 'IBMPlexSans');
      expect(tema.extension<AccesoTokens>(), isNotNull);
    }
    expect(const Tipografia().mono(16).fontFamily, 'IBMPlexMono');
  });
}
