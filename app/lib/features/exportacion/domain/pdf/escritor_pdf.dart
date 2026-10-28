import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';

/// Arma un archivo PDF objeto por objeto: cada uno con su número, y al final
/// la tabla `xref` con el desplazamiento de cada uno, que es lo que permite a
/// un visor saltar a cualquier página. Puro: solo bytes.
///
/// Los objetos se numeran de 1 en adelante sin huecos (así lo exige `xref`).
/// Los flujos (páginas, fuentes) se comprimen con Flate, que es lo que el PDF
/// espera; el resto es texto ASCII.
class EscritorPdf {
  final Map<int, Uint8List> _objetos = {};

  /// Un objeto cuyo cuerpo es un diccionario u otro valor PDF.
  void objeto(int numero, String cuerpo) {
    _objetos[numero] = _ascii('$numero 0 obj\n$cuerpo\nendobj\n');
  }

  /// Un flujo: un diccionario más datos binarios. La longitud la pone este
  /// método; [diccionario] lleva lo demás (filtro, longitud sin comprimir).
  void flujo(int numero, String diccionario, Uint8List datos) {
    final cabecera = _ascii(
      '$numero 0 obj\n<< $diccionario /Length ${datos.length} >>\nstream\n',
    );
    final cola = _ascii('\nendstream\nendobj\n');
    _objetos[numero] = Uint8List.fromList([...cabecera, ...datos, ...cola]);
  }

  /// Comprime datos para un flujo con `/Filter /FlateDecode`.
  static Uint8List comprimir(Uint8List datos) =>
      Uint8List.fromList(const ZLibEncoder().encode(datos));

  /// El PDF completo: cabecera, objetos, `xref`, trailer. [raiz] es el
  /// catálogo y [informacion] el diccionario de información (título).
  Uint8List terminar({required int raiz, required int informacion}) {
    final salida = BytesBuilder(copy: false)..add(_cabecera);
    final numeros = _objetos.keys.toList()..sort();
    final desplazamientos = <int>[];
    for (final numero in numeros) {
      desplazamientos.add(salida.length);
      salida.add(_objetos[numero]!);
    }

    final inicioXref = salida.length;
    final total = numeros.length + 1;
    final xref = StringBuffer('xref\n0 $total\n0000000000 65535 f \n');
    // Cada entrada mide exactamente 20 bytes, como exige el formato.
    for (final desplazamiento in desplazamientos) {
      xref.write('${desplazamiento.toString().padLeft(10, '0')} 00000 n \n');
    }
    xref
      ..write('trailer\n')
      ..write('<< /Size $total /Root $raiz 0 R /Info $informacion 0 R >>\n')
      ..write('startxref\n$inicioXref\n%%EOF\n');
    salida.add(_ascii(xref.toString()));
    return salida.toBytes();
  }

  /// La cabecera: versión y una línea de bytes altos, para que los programas de
  /// transferencia traten el archivo como binario.
  static final Uint8List _cabecera = Uint8List.fromList([
    ...'%PDF-1.7\n%'.codeUnits,
    0xE2,
    0xE3,
    0xCF,
    0xD3,
    0x0A,
  ]);

  static Uint8List _ascii(String texto) =>
      Uint8List.fromList(latin1.encode(texto));
}
