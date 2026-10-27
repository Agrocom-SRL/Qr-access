import 'dart:math';
import 'dart:typed_data';

import 'package:agrocom_acceso/features/exportacion/domain/pdf/escritor_pdf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/pdf/fuente_ttf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';

/// Medidas en puntos (1/72 de pulgada), en A4 vertical. Las medidas del
/// documento viven aquí y no en la app: el dominio no conoce el tema.
const _ancho = 595.0;
const _alto = 842.0;
const _margen = 40.0;

/// Espacio reservado abajo para el pie "Página x de y".
const _espacioDePie = 28.0;
const _tamanoTitulo = 16.0;
const _tamanoTexto = 9.0;
const _tamanoPie = 8.0;
const _espacioTrasTitulo = 14.0;

/// Relleno de cada celda, a cada lado, y la altura de línea del texto.
const _relleno = 4.0;
const _interlinea = 1.3;

/// Dónde cae la línea base dentro de su línea, como fracción del tamaño.
const _ascenso = 0.78;

/// Ninguna columna pasa de este ancho: un texto largo se envuelve dentro.
const _anchoMaximoColumna = 200.0;

/// Colores en escala de grises (0 negro, 1 blanco): el PDF es para imprimir.
const _grisEncabezado = 0.92;
const _tintaNegra = 0;
const _grisLineas = 0.7;
const _grosorLinea = 0.5;

/// Nombres de las fuentes dentro de la página: F1 normal, F2 negrita.
const _recursoNormal = 'F1';
const _recursoNegrita = 'F2';

/// Números de objeto fijos: el catálogo, las páginas y la información; luego
/// cinco objetos por fuente; luego, de dos en dos, cada página y su contenido.
const _numeroCatalogo = 1;
const _numeroPaginas = 2;
const _numeroInformacion = 3;
const _baseNormal = 4;
const _baseNegrita = 9;
const _primeraPagina = 14;

final _espacios = RegExp(r'\s+');

/// Arma un PDF con la tabla: título, fecha y parte arriba; el encabezado de la
/// tabla y sus filas, con las columnas en proporción a su contenido; y en cada
/// hoja, el encabezado que se repite y el pie "Página x de y".
///
/// Las fuentes van embebidas (IBM Plex: tildes y eñes), así el PDF se ve igual
/// en cualquier visor.
Uint8List tablaAPdf(
  TablaDeExportacion tabla,
  TextosDeDocumento textos,
  FuentesDePdf fuentes,
) => _Maquetador(tabla, textos, fuentes).generar();

/// Una fila ya medida: sus líneas por celda, lo alto que ocupa y si es el
/// encabezado (en negrita y sobre fondo gris).
class _Fila {
  const new({required this.lineas, required this.alto, required this.negrita});

  final List<List<String>> lineas;
  final double alto;
  final bool negrita;
}

/// El estado de la maquetación: la página en curso, la altura en que va el
/// cursor y qué glifos se usan (para que la fuente solo declare sus anchos).
class _Maquetador {
  new(this._tabla, this._textos, this._fuentes);

  final TablaDeExportacion _tabla;
  final TextosDeDocumento _textos;
  final FuentesDePdf _fuentes;

  /// Una tabla sin encabezado (CSV vacío) se dibuja con una columna vacía.
  late final List<String> _encabezado = _tabla.encabezado.isEmpty
      ? const ['']
      : _tabla.encabezado;
  late final List<double> _anchos = _anchosDeColumnas();

  final List<StringBuffer> _paginas = [];
  final Set<int> _glifosNormal = {};
  final Set<int> _glifosNegrita = {};

  /// Altura del cursor, medida desde arriba de la hoja.
  double _y = _margen;

  double get _limiteInferior => _alto - _margen - _espacioDePie;

  double get _alturaDeLinea => _tamanoTexto * _interlinea;

  /// Cuántas líneas caben en una hoja, para que una sola fila nunca sea más
  /// alta que la hoja (si lo fuera, se cortaría sin remedio).
  int get _maximoDeLineas {
    const util = _alto - 2 * _margen - _espacioDePie - 2 * _relleno;
    return max(1, (util / _alturaDeLinea).floor());
  }

  Uint8List generar() {
    _nuevaPagina();
    _dibujarTitulo();
    final encabezado = _filaDe(_encabezado, negrita: true);
    _dibujar(encabezado);
    for (final celdas in _tabla.filas) {
      final fila = _filaDe(celdas, negrita: false);
      if (_y + fila.alto > _limiteInferior) {
        _nuevaPagina();
        _dibujar(encabezado);
      }
      _dibujar(fila);
    }
    _dibujarPies();
    return _escribir();
  }

  void _nuevaPagina() {
    _paginas.add(StringBuffer());
    _y = _margen;
  }

  StringBuffer get _paginaActual => _paginas.last;

  /// El ancho de cada columna: lo que ocupa su texto más largo (con un tope),
  /// escalado para que la tabla llene el ancho de la hoja.
  List<double> _anchosDeColumnas() {
    final naturales = <double>[];
    for (var c = 0; c < _encabezado.length; c++) {
      var mayor = _fuentes.negrita.anchoDe(_encabezado[c], _tamanoTexto);
      for (final fila in _tabla.filas) {
        if (c < fila.length) {
          final ancho = _fuentes.normal.anchoDe(fila[c], _tamanoTexto);
          if (ancho > mayor) mayor = ancho;
        }
      }
      naturales.add(min(mayor, _anchoMaximoColumna) + 2 * _relleno);
    }
    final suma = naturales.fold<double>(0, (total, ancho) => total + ancho);
    const disponible = _ancho - 2 * _margen;
    return [for (final ancho in naturales) ancho * disponible / suma];
  }

  /// Mide una fila: envuelve cada celda en su columna y toma la más alta.
  _Fila _filaDe(List<String> celdas, {required bool negrita}) {
    final fuente = negrita ? _fuentes.negrita : _fuentes.normal;
    final lineas = <List<String>>[];
    for (var c = 0; c < _anchos.length; c++) {
      final texto = c < celdas.length ? celdas[c] : '';
      final util = max(_anchos[c] - 2 * _relleno, _tamanoTexto);
      var ajustadas = _ajustar(texto, util, fuente);
      if (ajustadas.length > _maximoDeLineas) {
        ajustadas = ajustadas.sublist(0, _maximoDeLineas);
      }
      lineas.add(ajustadas);
    }
    final mayor = lineas.fold<int>(
      1,
      (total, celda) => max(total, celda.length),
    );
    return _Fila(
      lineas: lineas,
      alto: mayor * _alturaDeLinea + 2 * _relleno,
      negrita: negrita,
    );
  }

  /// Parte un texto en líneas que caben en [anchoUtil]: por palabras y, si una
  /// palabra no cabe sola, por caracteres.
  List<String> _ajustar(String texto, double anchoUtil, FuenteTtf fuente) {
    final lineas = <String>[];
    var actual = '';
    for (final palabra in texto.split(_espacios)) {
      if (palabra.isEmpty) continue;
      final junta = actual.isEmpty ? palabra : '$actual $palabra';
      if (fuente.anchoDe(junta, _tamanoTexto) <= anchoUtil) {
        actual = junta;
        continue;
      }
      if (actual.isNotEmpty) {
        lineas.add(actual);
        actual = '';
      }
      final partes = _partirPorCaracteres(palabra, anchoUtil, fuente);
      lineas.addAll(partes.take(partes.length - 1));
      actual = partes.last;
    }
    if (actual.isNotEmpty || lineas.isEmpty) lineas.add(actual);
    return lineas;
  }

  /// Parte una palabra que no cabe en la columna, carácter a carácter. La
  /// última parte puede ser más corta y queda para seguir la línea.
  List<String> _partirPorCaracteres(
    String palabra,
    double anchoUtil,
    FuenteTtf fuente,
  ) {
    final partes = <String>[];
    var actual = <int>[];
    for (final codigo in palabra.runes) {
      final candidata = String.fromCharCodes([...actual, codigo]);
      if (actual.isNotEmpty &&
          fuente.anchoDe(candidata, _tamanoTexto) > anchoUtil) {
        partes.add(String.fromCharCodes(actual));
        actual = <int>[];
      }
      actual.add(codigo);
    }
    partes.add(String.fromCharCodes(actual));
    return partes;
  }

  /// El título, la fecha de generación y, si hay más de una parte, cuál es.
  void _dibujarTitulo() {
    final bloque = <(String, FuenteTtf, double, bool)>[
      (_textos.titulo, _fuentes.negrita, _tamanoTitulo, true),
      (_textos.generado, _fuentes.normal, _tamanoTexto, false),
      if (_textos.parte != null)
        (_textos.parte!, _fuentes.normal, _tamanoTexto, false),
    ];
    var arriba = _margen;
    for (final (texto, fuente, tamano, negrita) in bloque) {
      _texto(
        _paginaActual,
        texto,
        fuente,
        tamano,
        _margen,
        arriba + tamano * _ascenso,
        negrita: negrita,
      );
      arriba += tamano * _interlinea;
    }
    _y = arriba + _espacioTrasTitulo;
  }

  /// Dibuja una fila: el fondo si es encabezado, el texto de cada celda y las
  /// líneas de la cuadrícula.
  void _dibujar(_Fila fila) {
    final pagina = _paginaActual;
    final arriba = _y;
    final abajo = _y + fila.alto;
    final ancho = _anchos.fold<double>(0, (total, a) => total + a);
    if (fila.negrita) {
      final base = _n(_yDePagina(abajo));
      final alto = _n(fila.alto);
      pagina.write(
        '${_n(_grisEncabezado)} g '
        '${_n(_margen)} $base ${_n(ancho)} $alto re f\n'
        // El fondo deja gris el relleno: el texto vuelve a negro.
        '$_tintaNegra g\n',
      );
    }

    final fuente = fila.negrita ? _fuentes.negrita : _fuentes.normal;
    var x = _margen;
    for (var c = 0; c < _anchos.length; c++) {
      final lineas = fila.lineas[c];
      for (var i = 0; i < lineas.length; i++) {
        // Centra la línea dentro de su altura de línea.
        final base =
            arriba +
            _relleno +
            i * _alturaDeLinea +
            (_alturaDeLinea - _tamanoTexto) / 2 +
            _tamanoTexto * _ascenso;
        _texto(
          pagina,
          lineas[i],
          fuente,
          _tamanoTexto,
          x + _relleno,
          base,
          negrita: fila.negrita,
        );
      }
      x += _anchos[c];
    }

    pagina.write('$_grisLineas G $_grosorLinea w\n');
    // Línea inferior de la fila y, en el encabezado, la superior de la tabla.
    _linea(pagina, _margen, abajo, _margen + ancho, abajo);
    if (fila.negrita) _linea(pagina, _margen, arriba, _margen + ancho, arriba);
    // Divisiones verticales, de la izquierda a la derecha.
    var xv = _margen;
    for (var c = 0; c <= _anchos.length; c++) {
      _linea(pagina, xv, arriba, xv, abajo);
      if (c < _anchos.length) xv += _anchos[c];
    }
    _y = abajo;
  }

  /// El pie "Página x de y" centrado, en cada hoja. Se dibuja al final, cuando
  /// ya se sabe cuántas hay.
  void _dibujarPies() {
    final total = _paginas.length;
    for (var i = 0; i < total; i++) {
      final texto = _textos.paginaDe(i + 1, total);
      final ancho = _fuentes.normal.anchoDe(texto, _tamanoPie);
      _texto(
        _paginas[i],
        texto,
        _fuentes.normal,
        _tamanoPie,
        (_ancho - ancho) / 2,
        _alto - _margen / 2,
        negrita: false,
      );
    }
  }

  /// Escribe una cadena de texto con sus glifos en hexadecimal (fuente de
  /// dos bytes por glifo, `Identity-H`). [baseArriba] se mide desde arriba.
  void _texto(
    StringBuffer destino,
    String texto,
    FuenteTtf fuente,
    double tamano,
    double x,
    double baseArriba, {
    required bool negrita,
  }) {
    final usados = negrita ? _glifosNegrita : _glifosNormal;
    final hex = StringBuffer();
    for (final codigo in texto.runes) {
      final glifo = fuente.glifo(codigo);
      usados.add(glifo);
      hex.write(_hex4(glifo));
    }
    final recurso = negrita ? _recursoNegrita : _recursoNormal;
    destino.write(
      'BT /$recurso ${_n(tamano)} Tf 1 0 0 1 ${_n(x)} '
      '${_n(_yDePagina(baseArriba))} Tm <$hex> Tj ET\n',
    );
  }

  void _linea(
    StringBuffer destino,
    double x1,
    double y1,
    double x2,
    double y2,
  ) {
    destino.write(
      '${_n(x1)} ${_n(_yDePagina(y1))} m ${_n(x2)} ${_n(_yDePagina(y2))} l S\n',
    );
  }

  /// PDF mide la altura desde abajo; el maquetador, desde arriba.
  double _yDePagina(double desdeArriba) => _alto - desdeArriba;

  /// Arma el archivo: catálogo, páginas, información, las dos fuentes y el
  /// contenido de cada hoja.
  Uint8List _escribir() {
    final escritor = EscritorPdf();
    final total = _paginas.length;
    final hojas = [
      for (var i = 0; i < total; i++) '${_primeraPagina + 2 * i} 0 R',
    ].join(' ');

    escritor
      ..objeto(
        _numeroCatalogo,
        '<< /Type /Catalog /Pages $_numeroPaginas 0 R >>',
      )
      ..objeto(
        _numeroPaginas,
        '<< /Type /Pages /Kids [$hojas] /Count $total >>',
      )
      ..objeto(
        _numeroInformacion,
        '<< /Title <${_hexUtf16(_textos.titulo)}> >>',
      );
    _fuente(escritor, _baseNormal, _fuentes.normal, _glifosNormal);
    _fuente(escritor, _baseNegrita, _fuentes.negrita, _glifosNegrita);

    const recursos =
        '<< /Font << /$_recursoNormal $_baseNormal 0 R '
        '/$_recursoNegrita $_baseNegrita 0 R >> >>';
    for (var i = 0; i < total; i++) {
      final numeroPagina = _primeraPagina + 2 * i;
      final numeroContenido = numeroPagina + 1;
      escritor
        ..objeto(
          numeroPagina,
          '<< /Type /Page /Parent $_numeroPaginas 0 R '
          '/MediaBox [0 0 ${_n(_ancho)} ${_n(_alto)}] '
          '/Resources $recursos /Contents $numeroContenido 0 R >>',
        )
        ..flujo(
          numeroContenido,
          '/Filter /FlateDecode',
          EscritorPdf.comprimir(_ascii(_paginas[i].toString())),
        );
    }
    return escritor.terminar(
      raiz: _numeroCatalogo,
      informacion: _numeroInformacion,
    );
  }

  /// Los cinco objetos de una fuente: el tipo compuesto, el descendiente con
  /// los anchos, el descriptor, el archivo de la fuente y el mapa a Unicode
  /// (para copiar y buscar el texto en el visor).
  void _fuente(
    EscritorPdf escritor,
    int base,
    FuenteTtf fuente,
    Set<int> usados,
  ) {
    final glifos = usados.toList()..sort();
    final anchos = StringBuffer('[');
    for (final glifo in glifos) {
      anchos.write('$glifo [${_mil(fuente.avance(glifo), fuente.unidades)}] ');
    }
    anchos.write(']');

    final nombre = fuente.nombre;
    final caja = [for (final v in fuente.cajaDelTipo) _mil(v, fuente.unidades)]
        .join(' ');
    escritor
      ..objeto(
        base,
        '<< /Type /Font /Subtype /Type0 /BaseFont /$nombre '
        '/Encoding /Identity-H /DescendantFonts [${base + 1} 0 R] '
        '/ToUnicode ${base + 4} 0 R >>',
      )
      ..objeto(
        base + 1,
        '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /$nombre '
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> '
        '/FontDescriptor ${base + 2} 0 R /DW 1000 /W $anchos '
        '/CIDToGIDMap /Identity >>',
      )
      ..objeto(
        base + 2,
        '<< /Type /FontDescriptor /FontName /$nombre /Flags 32 '
        '/FontBBox [$caja] /ItalicAngle 0 '
        '/Ascent ${_mil(fuente.ascendente, fuente.unidades)} '
        '/Descent ${_mil(fuente.descendente, fuente.unidades)} '
        '/CapHeight ${_mil(fuente.altoDeMayusculas, fuente.unidades)} /StemV 80 '
        '/FontFile2 ${base + 3} 0 R >>',
      )
      ..flujo(
        base + 3,
        '/Length1 ${fuente.bytes.length} /Filter /FlateDecode',
        EscritorPdf.comprimir(fuente.bytes),
      )
      ..flujo(
        base + 4,
        '/Filter /FlateDecode',
        EscritorPdf.comprimir(_mapaAUnicode(fuente, glifos)),
      );
  }

  /// El mapa glifo → carácter Unicode de los glifos usados, en el formato
  /// `ToUnicode` que lee el visor para copiar y buscar.
  Uint8List _mapaAUnicode(FuenteTtf fuente, List<int> glifos) {
    final usados = glifos.toSet();
    final codigoPorGlifo = <int, int>{};
    fuente.caracteres.forEach((codigo, glifo) {
      if (usados.contains(glifo)) {
        codigoPorGlifo.putIfAbsent(glifo, () => codigo);
      }
    });
    final pares = [
      for (final glifo in glifos)
        if (codigoPorGlifo.containsKey(glifo))
          '<${_hex4(glifo)}> <${_hex4(codigoPorGlifo[glifo]!)}>',
    ];
    // Un bloque `beginbfchar` admite como mucho 100 pares.
    final bloques = StringBuffer();
    for (var i = 0; i < pares.length; i += 100) {
      final hasta = min(i + 100, pares.length);
      bloques
        ..write('${hasta - i} beginbfchar\n')
        ..write(pares.sublist(i, hasta).join('\n'))
        ..write('\nendbfchar\n');
    }
    return _ascii(
      '/CIDInit /ProcSet findresource begin\n'
      '12 dict begin\nbegincmap\n'
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n'
      '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n'
      '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'
      '$bloques'
      'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n',
    );
  }
}

/// Un número con dos decimales, sin notación científica (que el PDF no lee).
String _n(double valor) => valor.toStringAsFixed(2);

/// Un valor de la fuente pasado a milésimas de em, que es la escala del PDF.
int _mil(int valor, int unidadesPorEm) =>
    (valor * 1000 / unidadesPorEm).round();

/// Un glifo o un código en cuatro dígitos hexadecimales, en mayúsculas.
String _hex4(int valor) =>
    valor.toRadixString(16).padLeft(4, '0').toUpperCase();

/// El título como cadena hexadecimal UTF-16BE con su marca de orden (FEFF),
/// que es la forma que el PDF admite para textos no ASCII.
String _hexUtf16(String texto) {
  final buffer = StringBuffer('FEFF');
  for (final unidad in texto.codeUnits) {
    buffer.write(_hex4(unidad));
  }
  return buffer.toString();
}

Uint8List _ascii(String texto) => Uint8List.fromList(texto.codeUnits);
