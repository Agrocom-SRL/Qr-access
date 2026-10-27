import 'dart:typed_data';

import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';
import 'package:archive/archive.dart';

/// Arma un libro de Excel (.xlsx) con la tabla en una sola hoja: encabezado en
/// negrita y fijo al bajar, columnas con el ancho de su contenido.
///
/// Se escribe a mano porque un .xlsx es un ZIP con cuatro o cinco XML chicos.
/// Así no sumamos un paquete de hojas de cálculo: los que hay exigen `archive`
/// 3, y el proyecto ya usa `archive` 4 (lottie). Las celdas son texto en línea
/// (no fórmulas), así que lo que escribió una persona nunca se ejecuta.
Uint8List tablaAXlsx(TablaDeExportacion tabla, {required String nombreHoja}) {
  final libro = Archive()
    ..addFile(ArchiveFile.string('[Content_Types].xml', _tiposDeContenido))
    ..addFile(ArchiveFile.string('_rels/.rels', _relacionesRaiz))
    ..addFile(ArchiveFile.string('xl/workbook.xml', _libro(nombreHoja)))
    ..addFile(
      ArchiveFile.string('xl/_rels/workbook.xml.rels', _relacionesLibro),
    )
    ..addFile(ArchiveFile.string('xl/styles.xml', _estilos))
    ..addFile(ArchiveFile.string('xl/worksheets/sheet1.xml', _hoja(tabla)));
  return Uint8List.fromList(ZipEncoder().encode(libro));
}

/// Ancho mínimo y máximo de una columna, en caracteres de Excel. Un texto muy
/// largo no estira la hoja entera.
const _anchoMinimoColumna = 10;
const _anchoMaximoColumna = 60;

/// Un margen de caracteres a cada lado de la columna, para que el texto no
/// quede pegado a la línea.
const _margenColumna = 2;

/// Estilo 0 = normal; estilo 1 = negrita (el encabezado).
const _estiloNormal = 0;
const _estiloEncabezado = 1;

/// Excel no admite estos caracteres en el nombre de una hoja, y el límite es
/// 31.
final _caracteresProhibidosEnHoja = RegExp(r'[\[\]:*?/\\]');
const _longitudMaximaHoja = 31;

/// Caracteres que no son válidos en XML 1.0, aunque vengan en el texto.
final _caracteresNoXml = RegExp(r'[\x00-\x08\x0B\x0C\x0E-\x1F]');

const _cabeceraXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

final String _tiposDeContenido = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
  '<Default Extension="xml" ContentType="application/xml"/>',
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
  '</Types>',
].join();

final String _relacionesRaiz = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
  '</Relationships>',
].join();

final String _relacionesLibro = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
  '</Relationships>',
].join();

/// Dos fuentes (normal y negrita) y los dos estilos de celda que usa la hoja.
final String _estilos = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font>',
  '<b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2">',
  '<fill><patternFill patternType="none"/></fill><fill>',
  '<patternFill patternType="gray125"/></fill></fills><borders count="1">',
  '<border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="2">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  '</cellXfs><cellStyles count="1">',
  '<cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
  '</styleSheet>',
].join();

String _libro(String nombreHoja) =>
    '$_cabeceraXml'
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    '<sheets><sheet name="${_xml(_nombreDeHoja(nombreHoja))}" sheetId="1" '
    'r:id="rId1"/></sheets></workbook>';

/// El nombre de la hoja sin lo que Excel rechaza. Si no queda nada, una hoja
/// genérica.
String _nombreDeHoja(String nombre) {
  final limpio = nombre.replaceAll(_caracteresProhibidosEnHoja, '').trim();
  if (limpio.isEmpty) return 'Datos';
  return limpio.length > _longitudMaximaHoja
      ? limpio.substring(0, _longitudMaximaHoja)
      : limpio;
}

/// La hoja: el encabezado en la fila 1 (en negrita y fijo) y las filas de datos
/// debajo, con sus anchos de columna.
String _hoja(TablaDeExportacion tabla) {
  final columnas = tabla.encabezado.length;
  final buffer = StringBuffer(
    [
      _cabeceraXml,
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<sheetViews><sheetView workbookViewId="0">',
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
      '</sheetView></sheetViews>',
    ].join(),
  );
  if (columnas > 0) {
    final anchos = [for (var c = 0; c < columnas; c++) _anchoDe(tabla, c)];
    buffer.write('<cols>');
    for (var c = 0; c < columnas; c++) {
      final numero = c + 1;
      buffer.write(
        '<col min="$numero" max="$numero" width="${anchos[c]}" '
        'customWidth="1"/>',
      );
    }
    buffer.write('</cols>');
  }
  buffer
    ..write('<sheetData>')
    ..write(_fila(1, tabla.encabezado, columnas, _estiloEncabezado));
  for (var f = 0; f < tabla.filas.length; f++) {
    buffer.write(_fila(f + 2, tabla.filas[f], columnas, _estiloNormal));
  }
  buffer.write('</sheetData></worksheet>');
  return buffer.toString();
}

/// Una fila con sus celdas. Una fila más corta que el encabezado deja fuera
/// las celdas que faltan: Excel las muestra vacías.
String _fila(int numero, List<String> celdas, int columnas, int estilo) {
  final buffer = StringBuffer('<row r="$numero">');
  for (var c = 0; c < celdas.length && c < columnas; c++) {
    final referencia = '${_letraDeColumna(c)}$numero';
    final texto = _xml(celdas[c]);
    buffer.write(
      [
        '<c r="$referencia" s="$estilo" t="inlineStr">',
        '<is><t xml:space="preserve">$texto</t></is></c>',
      ].join(),
    );
  }
  buffer.write('</row>');
  return buffer.toString();
}

/// El ancho de una columna: lo que ocupa su texto más largo (encabezado
/// incluido), con un margen, entre el mínimo y el máximo.
int _anchoDe(TablaDeExportacion tabla, int columna) {
  var mayor = tabla.encabezado[columna].runes.length;
  for (final fila in tabla.filas) {
    if (columna < fila.length) {
      final largo = fila[columna].runes.length;
      if (largo > mayor) mayor = largo;
    }
  }
  final ancho = mayor + _margenColumna;
  if (ancho < _anchoMinimoColumna) return _anchoMinimoColumna;
  if (ancho > _anchoMaximoColumna) return _anchoMaximoColumna;
  return ancho;
}

/// La letra (o letras) de una columna de Excel: 0 → A, 25 → Z, 26 → AA.
String _letraDeColumna(int indice) {
  var resto = indice;
  final letras = StringBuffer();
  do {
    letras.writeCharCode('A'.codeUnitAt(0) + resto % 26);
    resto = resto ~/ 26 - 1;
  } while (resto >= 0);
  return letras.toString().split('').reversed.join();
}

/// Escapa lo que va dentro de un nodo XML, y quita los caracteres que XML 1.0
/// no admite (un byte de control en un texto rompería el archivo entero).
String _xml(String texto) => texto
    .replaceAll(_caracteresNoXml, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
