import 'dart:convert';
import 'dart:typed_data';

import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_xlsx.dart';
import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';

/// Lee una parte del .xlsx (un ZIP) como texto.
String _parte(Uint8List xlsx, String nombre) {
  final libro = ZipDecoder().decodeBytes(xlsx);
  final archivo = libro.files.firstWhere((f) => f.name == nombre);
  return utf8.decode(archivo.content as List<int>);
}

void main() {
  const tabla = TablaDeExportacion(
    encabezado: ['Nombre', 'Rol'],
    filas: [
      ['Peña, José', 'Administrador'],
      ['Ana & <Luis>', 'Titular'],
    ],
  );

  test('el archivo es un ZIP (empieza con PK) con las partes del libro', () {
    final xlsx = tablaAXlsx(tabla, nombreHoja: 'Usuarios');

    expect(xlsx.sublist(0, 2), [0x50, 0x4B]);
    final nombres = ZipDecoder().decodeBytes(xlsx).files.map((f) => f.name);
    expect(
      nombres,
      containsAll([
        '[Content_Types].xml',
        'xl/workbook.xml',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
      ]),
    );
  });

  test('el encabezado va en negrita y fijo, y las filas debajo', () {
    final hoja = _parte(
      tablaAXlsx(tabla, nombreHoja: 'Usuarios'),
      'xl/worksheets/sheet1.xml',
    );

    expect(hoja, contains('<c r="A1" s="1" t="inlineStr">'));
    expect(hoja, contains('<c r="A2" s="0" t="inlineStr">'));
    expect(hoja, contains('state="frozen"'));
  });

  test('conserva tildes y eñes, y escapa los caracteres del XML', () {
    final hoja = _parte(
      tablaAXlsx(tabla, nombreHoja: 'Usuarios'),
      'xl/worksheets/sheet1.xml',
    );

    expect(hoja, contains('Peña, José'));
    expect(hoja, contains('Ana &amp; &lt;Luis&gt;'));
  });

  test('cada columna tiene su ancho según el texto más largo', () {
    final hoja = _parte(
      tablaAXlsx(tabla, nombreHoja: 'Usuarios'),
      'xl/worksheets/sheet1.xml',
    );

    // "Administrador" son 13 caracteres: 13 + 2 de margen.
    expect(hoja, contains('<col min="2" max="2" width="15" customWidth="1"/>'));
    // "Ana & <Luis>" son 12 caracteres: 12 + 2 de margen.
    expect(hoja, contains('<col min="1" max="1" width="14" customWidth="1"/>'));
  });

  test('el nombre de la hoja sale del título y sin caracteres prohibidos', () {
    final libro = _parte(
      tablaAXlsx(tabla, nombreHoja: 'Accesos: a/puertas'),
      'xl/workbook.xml',
    );

    expect(libro, contains('name="Accesos apuertas"'));
  });

  test('una tabla sin encabezado sale como libro vacío, sin error', () {
    final xlsx = tablaAXlsx(
      const TablaDeExportacion(encabezado: [], filas: []),
      nombreHoja: 'Vacía',
    );

    expect(xlsx.sublist(0, 2), [0x50, 0x4B]);
    expect(_parte(xlsx, 'xl/worksheets/sheet1.xml'), contains('<sheetData>'));
  });
}
