import 'dart:math';

import 'package:agrocom_acceso/features/qr_accesos/domain/clave_idempotencia.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // UUID v4 (RFC 4122): versión 4 en el tercer grupo y variante 8, 9, a o b
  // en el cuarto.
  final formatoUuidV4 = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  );

  test('genera un UUID v4 con el formato del RFC 4122', () {
    for (var i = 0; i < 50; i++) {
      expect(generarClaveIdempotencia(Random(i)), matches(formatoUuidV4));
    }
  });

  test('dos claves seguidas del mismo azar son distintas', () {
    final azar = Random(7);

    final primera = generarClaveIdempotencia(azar);
    final segunda = generarClaveIdempotencia(azar);

    expect(primera, isNot(segunda));
  });

  test(
    'el azar inyectado es el único origen: la misma semilla da la misma clave',
    () {
      expect(
        generarClaveIdempotencia(Random(42)),
        generarClaveIdempotencia(Random(42)),
      );
    },
  );
}
