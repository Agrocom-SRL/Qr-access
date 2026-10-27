import 'dart:math';

import 'package:agrocom_acceso/core/sesion/instalacion.dart';
import 'package:agrocom_acceso/core/sesion/origen_de_sesion.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/instalacion_falsa.dart';

const _guardada = 'instalacion-guardada-01';

void main() {
  test('reutiliza la instalación guardada, sin generar otra', () async {
    final almacen = AlmacenInstalacionFalso(_guardada);
    final proveedor = ProveedorOrigenDeSesion(almacen, 'android');

    final origen = await proveedor.leer();

    expect(origen.instalacionId, _guardada);
    expect(origen.plataforma, 'android');
    expect(almacen.guardados, isEmpty);
  });

  test('la primera vez genera una instalación y la guarda', () async {
    final almacen = AlmacenInstalacionFalso();
    final proveedor = ProveedorOrigenDeSesion(almacen, 'web', azar: Random(3));

    final origen = await proveedor.leer();

    expect(esInstalacionIdValido(origen.instalacionId), isTrue);
    expect(almacen.guardados, [origen.instalacionId]);
    expect(almacen.instalacionId, origen.instalacionId);
  });

  test('un valor guardado que no tiene el formato se reemplaza', () async {
    final almacen = AlmacenInstalacionFalso('corto');
    final proveedor = ProveedorOrigenDeSesion(almacen, null, azar: Random(3));

    final origen = await proveedor.leer();

    expect(origen.instalacionId, isNot('corto'));
    expect(esInstalacionIdValido(origen.instalacionId), isTrue);
    expect(almacen.guardados, [origen.instalacionId]);
  });

  test(
    'es estable dentro de la ejecución: dos inicios no generan dos ids',
    () async {
      final almacen = AlmacenInstalacionFalso();
      final proveedor = ProveedorOrigenDeSesion(
        almacen,
        'ios',
        azar: Random(9),
      );

      final (primero, segundo) = (
        await proveedor.leer(),
        await proveedor.leer(),
      );

      expect(segundo.instalacionId, primero.instalacionId);
      expect(almacen.guardados, hasLength(1));
      expect(almacen.lecturas, 1);
    },
  );

  test('un almacén roto no bloquea el inicio de sesión', () async {
    final almacen = AlmacenInstalacionFalso()
      ..errorAlLeer = Exception('almacén bloqueado');
    final proveedor = ProveedorOrigenDeSesion(
      almacen,
      'android',
      azar: Random(5),
    );

    final origen = await proveedor.leer();

    expect(esInstalacionIdValido(origen.instalacionId), isTrue);
    expect(origen.plataforma, 'android');
  });
}
