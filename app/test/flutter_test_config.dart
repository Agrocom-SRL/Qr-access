import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

/// Diferencia de píxeles que se tolera al comparar goldens. Se generan en
/// macOS y la CI corre en Linux: el texto se rasteriza distinto (~0,4 %) sin
/// que el diseño haya cambiado. Un cambio real de diseño supera este margen.
const _toleranciaGolden = 0.01;

/// Comparador de goldens que acepta la diferencia de rasterizado entre
/// plataformas.
class _ComparadorTolerante extends LocalFileComparator {
  new(super.testFile);

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final resultado = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    return resultado.passed || resultado.diffPercent <= _toleranciaGolden;
  }
}

Future<void> testExecutable(FutureOr<void> Function() pruebas) async {
  final base = goldenFileComparator;
  if (base is LocalFileComparator) {
    goldenFileComparator = _ComparadorTolerante(Uri.parse('${base.basedir}/_'));
  }
  await pruebas();
}
