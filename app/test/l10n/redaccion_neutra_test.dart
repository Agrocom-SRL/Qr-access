import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// ADR 0013 y skill `redaccion-neutra`: tuteo estándar, nunca voseo ni usted.
/// Solo se revisa el español: son reglas de esa lengua (en inglés y portugués
/// el imperativo formal es el habitual y no es un defecto).
const _voseo = {
  'seleccioná',
  'confirmá',
  'confirmás',
  'guardá',
  'cargá',
  'marcá',
  'mirá',
  'buscá',
  'revisá',
  'actualizá',
  'activá',
  'adjuntá',
  'probá',
  'esperá',
  'leé',
  'ingresá',
  'completá',
  'agregá',
  'eliminá',
  'verificá',
  'indicá',
  'cancelá',
  'corregí',
  'subí',
  'desactivá',
  'repetí',
  'intentá',
  'escribí',
  'elegí',
  'avisame',
  'fijate',
  'acordate',
  'volvé',
  'andá',
  'vení',
  'decí',
  'decime',
  'salí',
  'hacé',
  'hacés',
  'poné',
  'tené',
  'tenés',
  'sos',
  'vos',
  'podés',
  'querés',
  'sabés',
  'compartí',
  'abrí',
  'anulá',
  'generá',
  'emití',
};
const _usted = {
  'usted',
  'ustedes',
  'seleccione',
  'confirme',
  'guarde',
  'ingrese',
  'elija',
  'intente',
  'verifique',
  'escriba',
  'comparta',
  'revise',
  'espere',
  'complete',
  'agregue',
  'elimine',
  'cancele',
  'genere',
  'emita',
};

void main() {
  final arbs = Directory('lib/l10n')
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('app_es.arb'));

  test('hay al menos un ARB', () => expect(arbs, isNotEmpty));

  for (final arb in arbs) {
    test('${arb.path} está en tuteo', () {
      final textos =
          (jsonDecode(arb.readAsStringSync()) as Map<String, Object?>).entries
              .where((e) => !e.key.startsWith('@'))
              .map((e) => (e.key, '${e.value}'));
      final hallazgos = <String>[
        for (final (clave, texto) in textos)
          for (final palabra in texto.toLowerCase().split(
            RegExp(r'[^\p{L}]+', unicode: true),
          ))
            if (_voseo.contains(palabra) || _usted.contains(palabra))
              '$clave: "$palabra"',
      ];
      expect(hallazgos, isEmpty, reason: 'Ver la tabla de redaccion-neutra');
    });
  }
}
