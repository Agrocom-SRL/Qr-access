import 'package:flutter_test/flutter_test.dart';

import '../helpers/fuentes.dart';

/// Invariante 12 / ADR 0013: ningún texto de interfaz fuera del ARB.
void main() {
  test('ningún texto visible literal en lib/', () {
    final patron = RegExp(
      r'''(\bText\(\s*|\b(labelText|hintText|helperText|errorText|tooltip|'''
      r'''title|semanticLabel|message)\s*:\s*)(const\s+)?['"][^'"]*\p{L}''',
      unicode: true,
    );
    final hallazgos = <String>[
      for (final f in fuentesDart())
        for (final (n, linea) in lineasDeCodigo(f))
          if (patron.hasMatch(linea)) '${relativa(f)}:$n  ${linea.trim()}',
    ];
    expect(hallazgos, isEmpty, reason: 'Agrega la clave en app_es.arb');
  });
}
