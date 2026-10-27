import 'dart:typed_data';

import 'package:agrocom_acceso/features/exportacion/domain/pdf/fuente_ttf.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../../helpers/fuentes_pdf_de_prueba.dart';

void main() {
  final fuentes = fuentesDePrueba();

  group('fuente IBM Plex (la que empaqueta la app)', () {
    test('tiene glifos para las tildes y la eñe', () {
      final fuente = fuentes.normal;

      for (final codigo in 'áéíóúÁÉÍÓÚñÑüÜ¿¡'.runes) {
        expect(
          fuente.glifo(codigo),
          isNot(0),
          reason: 'falta el glifo de "${String.fromCharCode(codigo)}"',
        );
      }
    });

    test('la negrita también los tiene', () {
      expect(fuentes.negrita.glifo('ñ'.codeUnitAt(0)), isNot(0));
    });

    test('un carácter que no existe cae en el glifo 0', () {
      expect(fuentes.normal.glifo(0x1F600), 0);
    });

    test('mide las unidades por em del tipo', () {
      expect(fuentes.normal.unidades, 1000);
    });

    test('el ancho de un texto crece con su largo', () {
      final corto = fuentes.normal.anchoDe('Ana', 9);
      final largo = fuentes.normal.anchoDe('Administrador de la cuenta', 9);

      expect(corto, greaterThan(0));
      expect(largo, greaterThan(corto));
    });

    test('la negrita de la misma letra es un poco más ancha o igual', () {
      final normal = fuentes.normal.anchoDe('Usuarios', 10);
      final negrita = fuentes.negrita.anchoDe('Usuarios', 10);

      expect(negrita, closeTo(normal, normal * 0.2));
    });
  });

  test('un archivo que no es una fuente TrueType se rechaza', () {
    expect(
      () => leerFuenteTtf(Uint8List(64), nombre: 'Basura'),
      throwsA(isA<FormatException>()),
    );
  });
}
