import 'dart:math' as math;

import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/painting.dart';
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

/// Contraste AA (≥ 4.5) de los pares de texto del sistema de diseño (§2).
void main() {
  for (final (nombre, c) in [
    ('claro', ColoresSemanticos.claro),
    ('oscuro', ColoresSemanticos.oscuro),
  ]) {
    group('tema $nombre', () {
      final pares = {
        'texto/superficie': (c.texto, c.superficie),
        'texto/fondo': (c.texto, c.fondo),
        'textoSecundario/superficie': (c.textoSecundario, c.superficie),
        'sobrePrimario/primario': (c.sobrePrimario, c.primario),
        'peligro/superficie': (c.peligro, c.superficie),
        'advertencia/superficie': (c.advertencia, c.superficie),
        'informacion/superficie': (c.informacion, c.superficie),
      };
      for (final MapEntry(key: par, value: (a, b)) in pares.entries) {
        test('$par cumple AA', () {
          expect(contraste(a, b), greaterThanOrEqualTo(4.5));
        });
      }
    });
  }
}
