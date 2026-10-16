import 'package:flutter_test/flutter_test.dart';

import '../helpers/fuentes.dart';

/// Invariante 12 / ADR 0012: ningún color, tamaño ni duración fuera de los
/// tokens del tema.
void main() {
  test('ningún color literal fuera de primitivos.dart', () {
    final patron = RegExp(r'\bColor\(0x|\bColors\.|Color\.fromARGB|fromRGBO');
    final hallazgos = <String>[
      for (final f in fuentesDart())
        if (!relativa(f).endsWith('core/theme/primitivos.dart'))
          for (final (n, linea) in lineasDeCodigo(f))
            if (patron.hasMatch(linea)) '${relativa(f)}:$n  ${linea.trim()}',
    ];
    expect(hallazgos, isEmpty, reason: 'Usa los semánticos de context.tokens');
  });

  test('ningún tamaño, radio ni duración literal fuera de core/theme', () {
    final patron = RegExp(
      r'(EdgeInsets\.\w+|SizedBox|BorderRadius\.\w+|Radius\.circular|'
      r'Duration)\([^)]*\b\d+(\.\d+)?\b',
    );
    final hallazgos = <String>[
      for (final f in fuentesDart())
        if (!relativa(f).contains('lib/core/theme/'))
          for (final (n, linea) in lineasDeCodigo(f))
            if (patron.hasMatch(linea)) '${relativa(f)}:$n  ${linea.trim()}',
    ];
    expect(hallazgos, isEmpty, reason: 'Usa context.tokens.espacio/radio/…');
  });
}
