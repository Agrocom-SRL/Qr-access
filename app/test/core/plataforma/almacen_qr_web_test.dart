import 'package:agrocom_acceso/core/plataforma/almacen_qr_web.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('guarda el texto de un QR vigente y lo borra', () async {
    final almacen = AlmacenQrWeb();
    await almacen.guardar(
      'a',
      'AQ1.uno',
      DateTime.now().add(const Duration(hours: 1)),
    );

    expect(await almacen.leer('a'), 'AQ1.uno');
    await almacen.borrar('a');
    expect(await almacen.leer('a'), isNull);
  });

  test('un QR vencido ya no se devuelve', () async {
    final almacen = AlmacenQrWeb();
    await almacen.guardar(
      'b',
      'AQ1.dos',
      DateTime.now().subtract(const Duration(seconds: 1)),
    );

    expect(await almacen.leer('b'), isNull);
  });
}
