import 'dart:io';

/// Archivos `.dart` escritos a mano bajo `lib/` (sin lo generado de l10n).
Iterable<File> fuentesDart([String raiz = 'lib']) =>
    Directory(raiz)
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) => !f.path.contains('/l10n/gen/'));

/// Ruta relativa con `/`, para mensajes y comparaciones.
String relativa(File f) => f.path.replaceAll(r'\', '/');

/// Líneas de código sin los comentarios de línea.
Iterable<(int, String)> lineasDeCodigo(File f) sync* {
  final lineas = f.readAsLinesSync();
  for (var i = 0; i < lineas.length; i++) {
    final linea = lineas[i].trimLeft();
    if (linea.startsWith('//')) continue;
    yield (i + 1, lineas[i]);
  }
}
