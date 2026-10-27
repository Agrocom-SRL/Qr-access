import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// Un teléfono en horizontal (852×393, iPhone 17 en landscape): la altura es la
/// restricción. Las pantallas de Perfil y de sus secciones tienen que
/// desplazarse y no desbordar.
const tamanoHorizontal = Size(852, 393);

/// Gira la ventana del test a horizontal. Quien llama tiene que haber montado
/// la pantalla antes (montarPantalla registra el reinicio del tamaño).
void usarHorizontal(WidgetTester tester) {
  tester.view
    ..physicalSize = tamanoHorizontal
    ..devicePixelRatio = 1;
}
