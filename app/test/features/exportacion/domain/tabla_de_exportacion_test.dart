import 'dart:convert';
import 'dart:typed_data';

import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';
import 'package:flutter_test/flutter_test.dart';

Uint8List _csv(String texto) => Uint8List.fromList(utf8.encode(texto));

void main() {
  group('leerCsv', () {
    test('separa el encabezado y las filas, con CRLF', () {
      final tabla = leerCsv(_csv('id,nombre\r\n1,Ana\r\n2,Luis\r\n'));

      expect(tabla.encabezado, ['id', 'nombre']);
      expect(tabla.filas, [
        ['1', 'Ana'],
        ['2', 'Luis'],
      ]);
    });

    test('quita el BOM de Excel para que no quede en la primera celda', () {
      final tabla = leerCsv(_csv('﻿id,nombre\n1,Ana\n'));

      expect(tabla.encabezado.first, 'id');
    });

    test('respeta comas y comillas dentro de un campo entre comillas', () {
      final tabla = leerCsv(
        _csv('nombre,nota\n"Pérez, Juan","dijo ""hola"""\n'),
      );

      expect(tabla.filas.single, ['Pérez, Juan', 'dijo "hola"']);
    });

    test('un salto de línea dentro de comillas es parte del dato', () {
      final tabla = leerCsv(_csv('a,b\n"uno\ndos",3\n'));

      expect(tabla.filas.single, ['uno\ndos', '3']);
    });

    test('la última fila cuenta aunque no tenga salto final', () {
      final tabla = leerCsv(_csv('a,b\n1,2'));

      expect(tabla.filas.single, ['1', '2']);
    });

    test('un CSV vacío da una tabla sin columnas ni filas', () {
      final tabla = leerCsv(_csv(''));

      expect(tabla.encabezado, isEmpty);
      expect(tabla.filas, isEmpty);
    });

    test('un CSV solo con encabezado da cero filas', () {
      final tabla = leerCsv(_csv('a,b\r\n'));

      expect(tabla.encabezado, ['a', 'b']);
      expect(tabla.filas, isEmpty);
    });
  });
}
