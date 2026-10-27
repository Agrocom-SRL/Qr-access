import 'dart:convert';
import 'dart:typed_data';

import 'package:agrocom_acceso/features/exportacion/domain/pdf/fuente_ttf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/pdf/tabla_pdf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';
import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../../helpers/fuentes_pdf_de_prueba.dart';

/// La tabla de prueba: [filas] filas con un texto que a veces se envuelve.
TablaDeExportacion _tabla({int filas = 3, String texto = 'Ana Pérez'}) =>
    TablaDeExportacion(
      encabezado: const ['Nombre', 'Rol', 'Estado'],
      filas: [
        for (var i = 0; i < filas; i++) ['$texto $i', 'Titular', 'Activo'],
      ],
    );

/// Cada objeto del archivo por su número, como texto (los bytes en latin1).
Map<int, String> _objetos(String pdf) {
  final objetos = <int, String>{};
  for (final m in RegExp(r'(\d+) 0 obj\n').allMatches(pdf)) {
    final fin = pdf.indexOf('endobj\n', m.end);
    objetos[int.parse(m.group(1)!)] = pdf.substring(m.end, fin);
  }
  return objetos;
}

/// El contenido de un flujo, ya descomprimido, como texto.
String _contenidoDe(String cuerpo) {
  final inicio = cuerpo.indexOf('stream\n') + 'stream\n'.length;
  final fin = cuerpo.lastIndexOf('\nendstream');
  final bytes = latin1.encode(cuerpo.substring(inicio, fin));
  return latin1.decode(const ZLibDecoder().decodeBytes(bytes));
}

/// El texto de cada página, en el orden del documento: el contenido de su
/// flujo, con los glifos en hexadecimal.
List<String> _contenidosDePaginas(Uint8List pdf) {
  final objetos = _objetos(latin1.decode(pdf));
  final paginas = objetos.values.where(
    (c) => RegExp(r'/Type /Page\b').hasMatch(c),
  );
  return [
    for (final pagina in paginas)
      _contenidoDe(
        objetos[int.parse(
          RegExp(r'/Contents (\d+) 0 R').firstMatch(pagina)!.group(1)!,
        )]!,
      ),
  ];
}

/// Los glifos de un texto en hexadecimal, como aparecen en el contenido.
String _hexDe(String texto, FuenteTtf fuente) => [
  for (final codigo in texto.runes)
    fuente.glifo(codigo).toRadixString(16).padLeft(4, '0').toUpperCase(),
].join();

void main() {
  final fuentes = fuentesDePrueba();

  Uint8List generar(TablaDeExportacion tabla, {String? parte}) =>
      tablaAPdf(tabla, textosDePrueba(parte: parte), fuentes);

  test('empieza con la cabecera de PDF y termina con su marca de fin', () {
    final pdf = generar(_tabla());

    expect(latin1.decode(pdf.sublist(0, 8)), '%PDF-1.7');
    expect(latin1.decode(pdf.sublist(pdf.length - 6)), '%%EOF\n');
  });

  test('la tabla xref apunta al inicio de cada objeto', () {
    final pdf = latin1.decode(generar(_tabla(filas: 80)));

    final inicio = int.parse(
      RegExp(r'startxref\n(\d+)').firstMatch(pdf)!.group(1)!,
    );
    expect(pdf.startsWith('xref', inicio), isTrue);
    final cabecera = RegExp(r'xref\n0 (\d+)\n')
        .firstMatch(pdf.substring(inicio))!;
    final total = int.parse(cabecera.group(1)!);
    final primera = inicio + cabecera.end + 20;
    for (var numero = 1; numero < total; numero++) {
      final entrada = pdf.substring(
        primera + (numero - 1) * 20,
        primera + numero * 20,
      );
      final desplazamiento = int.parse(entrada.substring(0, 10));
      expect(
        pdf.startsWith('$numero 0 obj', desplazamiento),
        isTrue,
        reason: 'el objeto $numero no está en $desplazamiento',
      );
    }
  });

  test('una tabla corta cabe en una hoja con su pie "Página 1 de 1"', () {
    final pdf = generar(_tabla());
    final paginas = _contenidosDePaginas(pdf);

    expect(paginas, hasLength(1));
    expect(
      paginas.single,
      contains('<${_hexDe('Página 1 de 1', fuentes.normal)}> Tj'),
    );
  });

  test('el título, la fecha y la parte van arriba, con sus glifos', () {
    final pdf = generar(_tabla(), parte: 'Parte 1 de 2');
    final contenido = _contenidosDePaginas(pdf).first;

    expect(contenido, contains(_hexDe('Usuarios', fuentes.negrita)));
    expect(
      contenido,
      contains(_hexDe('Generado el 27/10/2026 10:05', fuentes.normal)),
    );
    expect(contenido, contains(_hexDe('Parte 1 de 2', fuentes.normal)));
  });

  test('las tildes y la eñe se dibujan con los glifos de la fuente', () {
    final contenido = _contenidosDePaginas(generar(_tabla(texto: 'Peña Mañón')))
        .first;

    expect(contenido, contains(_hexDe('Peña', fuentes.normal)));
    expect(contenido, contains(_hexDe('Mañón', fuentes.normal)));
  });

  test('una tabla larga se parte en hojas, cada una con su encabezado', () {
    final pdf = generar(_tabla(filas: 150));
    final paginas = _contenidosDePaginas(pdf);

    expect(paginas.length, greaterThan(1));
    final encabezado = _hexDe('Nombre', fuentes.negrita);
    for (var i = 0; i < paginas.length; i++) {
      expect(paginas[i], contains(encabezado), reason: 'hoja ${i + 1}');
      expect(
        paginas[i],
        contains(
          _hexDe('Página ${i + 1} de ${paginas.length}', fuentes.normal),
        ),
      );
    }
  });

  test('una tabla sin filas sale con su encabezado y un pie', () {
    final pdf = generar(
      const TablaDeExportacion(encabezado: ['Nombre'], filas: []),
    );

    expect(_contenidosDePaginas(pdf), hasLength(1));
    expect(latin1.decode(pdf.sublist(0, 4)), '%PDF');
  });

  test('una celda con una palabra más ancha que la columna se parte', () {
    final palabra = 'x' * 200;
    final pdf = generar(
      TablaDeExportacion(
        encabezado: const ['Dato'],
        filas: [
          [palabra],
        ],
      ),
    );

    expect(_contenidosDePaginas(pdf), hasLength(1));
  });
}
