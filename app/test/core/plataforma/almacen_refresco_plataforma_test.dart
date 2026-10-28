import 'package:agrocom_acceso/core/plataforma/almacen_refresco_movil.dart';
import 'package:flutter_test/flutter_test.dart';

/// En móvil el refresco sigue en el almacén seguro (ADR 0033 §5).
///
/// La clase web (`almacen_refresco_web.dart`) no se prueba aquí: importa
/// `package:web`, que solo carga en el navegador, y `flutter test` corre en el
/// VM. Su contrato (no guarda nada, `viveEnCookie` es `true`) lo cubre el
/// fake de `test/helpers/fakes.dart` en los tests del controlador.
void main() {
  test('móvil: el refresco no vive en cookie (almacén seguro)', () {
    expect(AlmacenRefrescoMovil().viveEnCookie, isFalse);
  });
}
