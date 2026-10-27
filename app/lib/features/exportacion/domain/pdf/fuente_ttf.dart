import 'dart:typed_data';

/// Lo que el generador de PDF necesita de una fuente TrueType: qué glifo
/// dibuja cada carácter, cuánto ocupa cada glifo y las medidas del tipo. Se
/// lee de los bytes del archivo, sin paquetes de terceros.
///
/// Por qué no un paquete de PDF: los que existen arrastran `qr` 3 o
/// `archive` 3, y el proyecto usa `qr` 4 y `archive` 4 (lottie). Un PDF con
/// una fuente embebida es poco más que esto y el resto del archivo.
class FuenteTtf {
  const new({
    required this.nombre,
    required this.bytes,
    required this.unidades,
    required this.avances,
    required this.caracteres,
    required this.cajaDelTipo,
    required this.ascendente,
    required this.descendente,
    required this.altoDeMayusculas,
  });

  /// El nombre PostScript de la fuente (sin espacios).
  final String nombre;

  /// El archivo completo: el PDF lo incrusta entero.
  final Uint8List bytes;

  /// Unidades por em: 1000 en IBM Plex. Las medidas se dan en esta escala.
  final int unidades;

  /// El ancho de cada glifo, en unidades.
  final List<int> avances;

  /// Qué glifo dibuja cada carácter (su código Unicode).
  final Map<int, int> caracteres;

  /// Xmin, Ymin, Xmax, Ymax del tipo, en unidades.
  final List<int> cajaDelTipo;

  final int ascendente;
  final int descendente;
  final int altoDeMayusculas;

  /// El glifo de un carácter; 0 (el "no existe", que se dibuja vacío o con el
  /// cuadro de la fuente) si la fuente no lo tiene.
  int glifo(int codigo) => caracteres[codigo] ?? 0;

  /// El ancho de un glifo, en unidades. Un glifo fuera de la tabla cuenta como
  /// el último, igual que dicta el formato.
  int avance(int glifo) =>
      glifo < avances.length ? avances[glifo] : avances.last;

  /// El ancho de un texto en puntos, a un tamaño dado.
  double anchoDe(String texto, double tamano) {
    var total = 0;
    for (final caracter in texto.runes) {
      total += avance(glifo(caracter));
    }
    return total * tamano / unidades;
  }
}

/// Lee una fuente TrueType (`.ttf`) de sus bytes. [nombre] es el nombre
/// PostScript que lleva el PDF: el archivo no lo trae en una forma cómoda,
/// así que lo pone quien carga la fuente.
FuenteTtf leerFuenteTtf(Uint8List bytes, {required String nombre}) {
  final datos = ByteData.sublistView(bytes);
  final tablas = _tablas(datos);
  final head = _requerida(tablas, 'head');
  final hhea = _requerida(tablas, 'hhea');
  final hmtx = _requerida(tablas, 'hmtx');
  final maxp = _requerida(tablas, 'maxp');
  final cmap = _requerida(tablas, 'cmap');

  final unidades = datos.getUint16(head + 18);
  final caja = [
    for (final desplazamiento in [36, 38, 40, 42])
      datos.getInt16(head + desplazamiento),
  ];
  final ascendente = datos.getInt16(hhea + 4);
  final descendente = datos.getInt16(hhea + 6);
  final metricas = datos.getUint16(hhea + 34);
  final glifos = datos.getUint16(maxp + 4);
  // Los glifos sin ancho propio (después de los métricos) repiten el último.
  final avances = List<int>.generate(
    glifos,
    (glifo) =>
        datos.getUint16(hmtx + 4 * (glifo < metricas ? glifo : metricas - 1)),
  );

  final os2 = tablas['OS/2'];
  // Desde la versión 2 de OS/2 hay altura de mayúsculas; las viejas no la
  // traen, y entonces se usa el ascendente como aproximación.
  final altoDeMayusculas = os2 != null && datos.getUint16(os2) >= 2
      ? datos.getInt16(os2 + 88)
      : ascendente;

  return FuenteTtf(
    nombre: nombre,
    bytes: bytes,
    unidades: unidades,
    avances: avances,
    caracteres: _mapaDeCaracteres(datos, cmap),
    cajaDelTipo: caja,
    ascendente: ascendente,
    descendente: descendente,
    altoDeMayusculas: altoDeMayusculas,
  );
}

/// Las fuentes del PDF: la normal para el cuerpo y la de peso medio para los
/// títulos y el encabezado. Las dos llevan tildes y eñes (IBM Plex).
class FuentesDePdf {
  const new({required this.normal, required this.negrita});

  final FuenteTtf normal;
  final FuenteTtf negrita;
}

/// La posición de cada tabla del archivo, por su etiqueta de cuatro letras.
Map<String, int> _tablas(ByteData datos) {
  final cantidad = datos.getUint16(4);
  final tablas = <String, int>{};
  for (var i = 0; i < cantidad; i++) {
    final base = 12 + 16 * i;
    final etiqueta = String.fromCharCodes([
      datos.getUint8(base),
      datos.getUint8(base + 1),
      datos.getUint8(base + 2),
      datos.getUint8(base + 3),
    ]);
    tablas[etiqueta] = datos.getUint32(base + 8);
  }
  return tablas;
}

int _requerida(Map<String, int> tablas, String etiqueta) {
  final posicion = tablas[etiqueta];
  if (posicion == null) {
    throw FormatException('La fuente no trae la tabla $etiqueta');
  }
  return posicion;
}

/// Lee la subtabla `cmap` de formato 4 (Unicode del plano básico, la que traen
/// las fuentes de texto). Cada segmento va de un código a otro; si trae
/// `idRangeOffset`, el glifo sale de una tabla de glifos aparte.
Map<int, int> _mapaDeCaracteres(ByteData datos, int cmap) {
  final cantidad = datos.getUint16(cmap + 2);
  for (var i = 0; i < cantidad; i++) {
    final registro = cmap + 4 + 8 * i;
    final plataforma = datos.getUint16(registro);
    final codificacion = datos.getUint16(registro + 2);
    final desplazamiento = cmap + datos.getUint32(registro + 4);
    // Unicode: plataforma 0 (cualquiera) o 3 con codificación 1 (BMP).
    final esUnicode = plataforma == 0 || (plataforma == 3 && codificacion == 1);
    if (!esUnicode || datos.getUint16(desplazamiento) != 4) continue;
    return _formato4(datos, desplazamiento);
  }
  throw const FormatException('La fuente no trae un cmap Unicode de formato 4');
}

Map<int, int> _formato4(ByteData datos, int sub) {
  final segmentos = datos.getUint16(sub + 6) ~/ 2;
  final finales = sub + 14;
  final inicios = finales + 2 * segmentos + 2;
  final deltas = inicios + 2 * segmentos;
  final rangos = deltas + 2 * segmentos;

  final mapa = <int, int>{};
  for (var s = 0; s < segmentos; s++) {
    final fin = datos.getUint16(finales + 2 * s);
    final inicio = datos.getUint16(inicios + 2 * s);
    final delta = datos.getInt16(deltas + 2 * s);
    final offsetDeRango = datos.getUint16(rangos + 2 * s);
    // El último segmento (0xFFFF) es un centinela, no un rango de caracteres.
    if (inicio == 0xFFFF) continue;
    for (var codigo = inicio; codigo <= fin; codigo++) {
      int glifo;
      if (offsetDeRango == 0) {
        glifo = (codigo + delta) & 0xFFFF;
      } else {
        // El offset es relativo a su propia posición en la tabla.
        final direccion =
            rangos + 2 * s + offsetDeRango + 2 * (codigo - inicio);
        final valor = datos.getUint16(direccion);
        glifo = valor == 0 ? 0 : (valor + delta) & 0xFFFF;
      }
      if (glifo != 0) mapa[codigo] = glifo;
    }
  }
  return mapa;
}
