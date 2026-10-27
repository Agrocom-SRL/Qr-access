import 'package:flutter_test/flutter_test.dart';

/// Texto de accesibilidad de lo que pinta [buscador]: su etiqueta o, en un
/// botón con tooltip, el tooltip. Flutter expone el tooltip como `tooltip` de
/// la semántica y no como etiqueta, así que `find.bySemanticsLabel` no lo ve.
///
/// Una etiqueta explícita que lleva hijos con texto se suma a ellos tras un
/// salto de línea; por eso se compara solo la primera línea. Requiere
/// `tester.ensureSemantics()` activo en el test.
String textoSemanticoDe(WidgetTester tester, Finder buscador) {
  final datos = tester.getSemantics(buscador).getSemanticsData();
  final etiqueta = datos.label.split('\n').first;
  return datos.tooltip.isNotEmpty ? datos.tooltip : etiqueta;
}
