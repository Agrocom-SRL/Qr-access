import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Pin.desde', () {
    test('acepta un PIN bien formado', () {
      expect(Pin.desde('AGR7K2Q')?.valor, 'AGR7K2Q');
    });

    test('acepta minúsculas y normaliza a mayúsculas', () {
      expect(Pin.desde('agr7k2q')?.valor, 'AGR7K2Q');
    });

    test('quita los espacios de un PIN pegado con separadores', () {
      expect(Pin.desde(' AGR 7k2 q ')?.valor, 'AGR7K2Q');
    });

    test('rechaza un PIN con 6 caracteres', () {
      expect(Pin.desde('AGR7K2'), isNull);
    });

    test('rechaza un PIN con 8 caracteres', () {
      expect(Pin.desde('AGR7K2QX'), isNull);
    });

    test('rechaza un código de cuenta con dígitos', () {
      expect(Pin.desde('AG17K2Q'), isNull);
    });

    test('rechaza la Ñ: no forma parte del alfabeto del PIN (ADR 0018)', () {
      expect(Pin.desde('AÑR7K2Q'), isNull);
      expect(Pin.desde('AGRÑ2Q'), isNull);
    });

    test('rechaza caracteres que no son letras ni dígitos', () {
      expect(Pin.desde('AGR-7K2'), isNull);
    });

    test('rechaza el texto vacío', () {
      expect(Pin.desde(''), isNull);
    });
  });

  group('Pin.filtrarEntrada', () {
    test('deja pasar solo letras en las tres primeras posiciones', () {
      expect(Pin.filtrarEntrada('a1g'), 'AG');
    });

    test('acepta letras o dígitos después del código de la cuenta', () {
      expect(Pin.filtrarEntrada('agr7k2q'), 'AGR7K2Q');
    });

    test('corta en 7 caracteres', () {
      expect(Pin.filtrarEntrada('AGR7K2QZZZ'), 'AGR7K2Q');
    });

    test('quita la Ñ y los símbolos: el 7 no cabe donde va una letra', () {
      expect(Pin.filtrarEntrada('AGÑ-7k'), 'AGK');
    });

    test('un texto entero ya filtrado se devuelve igual', () {
      const pin = 'AGR7K2Q';
      expect(Pin.filtrarEntrada(pin), pin);
    });
  });

  group('Pin', () {
    test('codigoCuenta son las tres primeras letras', () {
      expect(Pin.desde('AGR7K2Q')?.codigoCuenta, 'AGR');
    });

    test('toString no muestra el sufijo secreto', () {
      final pin = Pin.desde('AGR7K2Q');
      expect(pin.toString(), 'Pin(AGR****)');
      expect(pin.toString(), isNot(contains('7K2Q')));
    });

    test('dos PIN iguales en texto son el mismo valor', () {
      expect(Pin.desde('agr7k2q'), Pin.desde('AGR7K2Q'));
    });
  });
}
