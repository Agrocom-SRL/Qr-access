import 'dart:math';

import 'package:agrocom_acceso/core/sesion/instalacion.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

final _formaUuid = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

void main() {
  group('generarInstalacionId', () {
    test('es un UUID v4 con su forma 8-4-4-4-12', () {
      final id = generarInstalacionId(Random(7));
      expect(_formaUuid.hasMatch(id), isTrue, reason: id);
    });

    test('cada llamada da un valor distinto con un azar que avanza', () {
      final azar = Random(7);
      final ids = {for (var i = 0; i < 50; i++) generarInstalacionId(azar)};
      expect(ids, hasLength(50));
    });

    test(
      'la misma semilla da el mismo valor (los tests son deterministas)',
      () {
        expect(
          generarInstalacionId(Random(42)),
          generarInstalacionId(Random(42)),
        );
      },
    );

    test('lo que genera pasa la validación que hace el servidor', () {
      for (var semilla = 0; semilla < 20; semilla++) {
        expect(
          esInstalacionIdValido(generarInstalacionId(Random(semilla))),
          isTrue,
        );
      }
    });
  });

  group('esInstalacionIdValido', () {
    test('acepta de 16 a 64 caracteres URL-safe', () {
      expect(esInstalacionIdValido('a' * 16), isTrue);
      expect(esInstalacionIdValido('A_-9' * 16), isTrue);
    });

    test('rechaza lo más corto, lo más largo y los caracteres ajenos', () {
      expect(esInstalacionIdValido('a' * 15), isFalse);
      expect(esInstalacionIdValido('a' * 65), isFalse);
      expect(esInstalacionIdValido('abc def ghi jkl mno'), isFalse);
      expect(esInstalacionIdValido('abcdefghijklmnop+'), isFalse);
      expect(esInstalacionIdValido(''), isFalse);
    });
  });

  group('plataformaDe', () {
    test('en web es web, sea cual sea la plataforma nativa', () {
      expect(
        plataformaDe(web: true, plataforma: TargetPlatform.android),
        'web',
      );
    });

    test('Android e iOS se declaran tal como la API las espera', () {
      expect(
        plataformaDe(web: false, plataforma: TargetPlatform.android),
        'android',
      );
      expect(plataformaDe(web: false, plataforma: TargetPlatform.iOS), 'ios');
    });

    test('otras plataformas no declaran ninguna', () {
      expect(
        plataformaDe(web: false, plataforma: TargetPlatform.macOS),
        isNull,
      );
    });
  });
}
