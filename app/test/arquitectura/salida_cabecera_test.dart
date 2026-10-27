import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../helpers/fuentes.dart';

/// Convención de salida de las cabeceras (`SalidaDeCabecera`): la flecha de
/// volver y la X de cerrar salen solo de `BotonSalidaCabecera`. Así, una
/// página nueva no pinta su propio botón con otro ícono ni con otro tamaño de
/// zona táctil.
void main() {
  test('la flecha y la X de salida solo se pintan en BotonSalidaCabecera', () {
    final patron = RegExp(
      r'Icons\.(arrow_back|close)\b|\bBackButton\b|\bCloseButton\b|'
      r'Icons\.arrow_back_ios',
    );
    // La X de exportación quita una fecha del filtro: no cierra la pantalla.
    final excepciones = {
      'lib/shared/widgets/molecules/boton_salida_cabecera.dart',
      'lib/features/exportacion/presentation/exportacion_pagina.dart',
    };
    final hallazgos = <String>[
      for (final File f in fuentesDart())
        if (!excepciones.contains(relativa(f)))
          for (final (n, linea) in lineasDeCodigo(f))
            if (patron.hasMatch(linea)) '${relativa(f)}:$n  ${linea.trim()}',
    ];
    expect(
      hallazgos,
      isEmpty,
      reason:
          'Usa BotonSalidaCabecera(salida: SalidaDeCabecera.volver | cerrar)',
    );
  });
}
