import 'dart:convert';
import 'dart:typed_data';

/// La página de una exportación leída del CSV de la API: el encabezado y las
/// filas de datos, todo como texto. Es lo que el PDF y el Excel dibujan; el
/// CSV original sigue bajando tal cual (con su BOM).
class TablaDeExportacion {
  const new({required this.encabezado, required this.filas});

  /// Los nombres de las columnas, en el orden del CSV.
  final List<String> encabezado;

  /// Las filas de datos (sin el encabezado). Pueden tener menos celdas que el
  /// encabezado: quien dibuja las completa con vacío.
  final List<List<String>> filas;
}

/// Lo que va escrito alrededor de la tabla en un documento (título, fecha,
/// parte y pie). Lo arma la pantalla con los textos de la app: el dominio no
/// conoce el ARB, así que aquí solo llega texto ya traducido.
class TextosDeDocumento {
  const new({
    required this.titulo,
    required this.generado,
    required this.paginaDe,
    this.parte,
  });

  /// Título del documento. También es el nombre de la hoja de Excel.
  final String titulo;

  /// La línea de fecha de generación, ya formateada en la zona del usuario.
  final String generado;

  /// "Parte 2 de 3", o `null` si la página es la única.
  final String? parte;

  /// El pie de cada hoja del PDF: "Página 1 de 3".
  final String Function(int pagina, int paginas) paginaDe;
}

/// Lee un CSV de la API y lo parte en encabezado y filas. Acepta el BOM de
/// Excel, CRLF o LF, y campos entre comillas con comillas duplicadas dentro
/// (RFC 4180). Un CSV vacío da una tabla sin columnas.
TablaDeExportacion leerCsv(Uint8List csv) {
  final texto = utf8.decode(csv, allowMalformed: true);
  // El BOM no es parte del dato: si quedara, la primera celda llevaría un
  // carácter invisible.
  final sinBom = texto.startsWith('﻿') ? texto.substring(1) : texto;
  final registros = _registrosDeCsv(sinBom);
  if (registros.isEmpty) {
    return const TablaDeExportacion(encabezado: [], filas: []);
  }
  return TablaDeExportacion(
    encabezado: registros.first,
    filas: registros.sublist(1),
  );
}

/// Parte el texto en registros y cada registro en campos, una pasada. Las
/// comas y los saltos dentro de comillas son del dato, no separadores.
List<List<String>> _registrosDeCsv(String texto) {
  final registros = <List<String>>[];
  var campos = <String>[];
  final celda = StringBuffer();
  var entreComillas = false;
  var i = 0;
  while (i < texto.length) {
    final c = texto[i];
    if (entreComillas) {
      if (c != '"') {
        celda.write(c);
      } else if (i + 1 < texto.length && texto[i + 1] == '"') {
        // Dos comillas seguidas dentro de un campo son una comilla literal.
        celda.write('"');
        i++;
      } else {
        entreComillas = false;
      }
    } else if (c == '"') {
      entreComillas = true;
    } else if (c == ',') {
      campos.add(celda.toString());
      celda.clear();
    } else if (c == '\r' || c == '\n') {
      if (c == '\r' && i + 1 < texto.length && texto[i + 1] == '\n') i++;
      campos.add(celda.toString());
      celda.clear();
      registros.add(campos);
      campos = <String>[];
    } else {
      celda.write(c);
    }
    i++;
  }
  // Un último registro sin salto de línea final también cuenta.
  if (celda.isNotEmpty || campos.isNotEmpty) {
    campos.add(celda.toString());
    registros.add(campos);
  }
  return registros;
}
