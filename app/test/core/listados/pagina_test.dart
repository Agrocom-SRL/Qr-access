import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:flutter_test/flutter_test.dart';

Pagina<int> _pagina({required int pagina, required int total}) =>
    Pagina(datos: const [], pagina: pagina, porPagina: 20, total: total);

void main() {
  group('Pagina.totalPaginas', () {
    test('divide el total en páginas completas y redondea hacia arriba', () {
      expect(_pagina(pagina: 1, total: 41).totalPaginas, 3);
    });

    test('un listado vacío cuenta como una página', () {
      expect(_pagina(pagina: 1, total: 0).totalPaginas, 1);
    });

    test('un total exacto no agrega una página de más', () {
      expect(_pagina(pagina: 1, total: 40).totalPaginas, 2);
    });
  });

  group('Pagina navegación', () {
    test('la primera página no tiene anterior', () {
      expect(_pagina(pagina: 1, total: 60).tieneAnterior, isFalse);
    });

    test('la última página no tiene siguiente', () {
      final ultima = _pagina(pagina: 3, total: 60);
      expect(ultima.tieneSiguiente, isFalse);
      expect(ultima.tieneAnterior, isTrue);
    });

    test('una página intermedia tiene anterior y siguiente', () {
      final media = _pagina(pagina: 2, total: 60);
      expect(media.tieneAnterior, isTrue);
      expect(media.tieneSiguiente, isTrue);
    });
  });
}
