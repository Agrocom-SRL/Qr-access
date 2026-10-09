import 'package:flutter_test/flutter_test.dart';

import '../helpers/fuentes.dart';

/// ADR 0003: una feature solo importa de otra su `<feature>.dart`.
void main() {
  test('las features no importan archivos internos de otra feature', () {
    final import = RegExp(
      r'''^import\s+['"]package:agrocom_acceso/features/([^/]+)/(.+)['"]''',
    );
    final hallazgos = <String>[];
    for (final f in fuentesDart()) {
      final ruta = relativa(f);
      final propia = RegExp('lib/features/([^/]+)/').firstMatch(ruta)?.group(1);
      for (final (n, linea) in lineasDeCodigo(f)) {
        final m = import.firstMatch(linea.trim());
        if (m == null) continue;
        final (feature, archivo) = (m.group(1)!, m.group(2)!);
        if (feature != propia && archivo != '$feature.dart') {
          hallazgos.add('$ruta:$n importa features/$feature/$archivo');
        }
      }
    }
    expect(hallazgos, isEmpty, reason: 'Importa solo features/<f>/<f>.dart');
  });

  test('core y shared no dependen de las features (salvo el router)', () {
    final hallazgos = <String>[
      for (final f in [
        ...fuentesDart('lib/core'),
        ...fuentesDart('lib/shared'),
      ])
        if (!relativa(f).contains('lib/core/router/'))
          for (final (n, linea) in lineasDeCodigo(f))
            if (linea.contains('package:agrocom_acceso/features/'))
              '${relativa(f)}:$n',
    ];
    expect(hallazgos, isEmpty);
  });

  test('nada de dart:io en código compartido entre web y móvil', () {
    final hallazgos = <String>[
      for (final f in fuentesDart())
        if (!relativa(f).endsWith('_movil.dart'))
          for (final (n, linea) in lineasDeCodigo(f))
            if (linea.contains("'dart:io'")) '${relativa(f)}:$n',
    ];
    expect(hallazgos, isEmpty, reason: 'Usa core/plataforma/*_movil.dart');
  });
}
