import 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_contrato.dart';
import 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_movil.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Los ajustes de web (`ajustes_cliente_http_web.dart`) no se importan aquí:
/// importan `package:dio/browser.dart` y `package:web`, que solo cargan en el
/// navegador, y `flutter test` corre en el VM. La cabecera que la API exige se
/// fija en `cabeceraDeLaAppWeb` (contrato, sin dependencias de navegador) y
/// se prueba aquí.
void main() {
  test('la cabecera de la app web es la que la API reconoce (ADR 0033 §5)', () {
    expect(cabeceraDeLaAppWeb, 'X-Requested-With');
    expect(valorDeLaAppWeb, 'agrocom-app');
  });

  group('móvil', () {
    test('no anuncia cabecera de navegador', () {
      expect(AjustesClienteHttpMovil().cabeceras, isEmpty);
    });

    test('no cambia el adaptador de red', () {
      final dio = Dio();
      final original = dio.httpClientAdapter;
      AjustesClienteHttpMovil().aplicar(dio);

      expect(dio.httpClientAdapter, same(original));
    });
  });
}
