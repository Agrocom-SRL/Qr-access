import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:flutter_test/flutter_test.dart';

SesionConectada _sesion(
  String id, {
  bool actual = false,
  DateTime? actividad,
  String? plataforma = 'android',
}) => SesionConectada(
  id: id,
  plataforma: plataforma,
  dispositivo: 'Equipo $id',
  ultimaActividadAt: actividad ?? DateTime.utc(2026, 10, 27, 12),
  actual: actual,
);

void main() {
  group('ordenarSesiones', () {
    test('la de este aparato va primero, aunque sea la más antigua', () {
      final ordenadas = ordenarSesiones([
        _sesion('a', actividad: DateTime.utc(2026, 10, 27, 15)),
        _sesion('b', actual: true, actividad: DateTime.utc(2026, 10, 27, 9)),
      ]);

      expect(ordenadas.map((s) => s.id), ['b', 'a']);
    });

    test('el resto va de la actividad más reciente a la más antigua', () {
      final ordenadas = ordenarSesiones([
        _sesion('viejo', actividad: DateTime.utc(2026, 10, 20)),
        _sesion('nuevo', actividad: DateTime.utc(2026, 10, 27)),
        _sesion('medio', actividad: DateTime.utc(2026, 10, 24)),
      ]);

      expect(ordenadas.map((s) => s.id), ['nuevo', 'medio', 'viejo']);
    });

    test('no modifica la lista que recibe', () {
      final original = [_sesion('x'), _sesion('y', actual: true)];
      ordenarSesiones(original);
      expect(original.map((s) => s.id), ['x', 'y']);
    });
  });

  group('puedeCerrarse y cuantasOtrasSesiones', () {
    test('la sesión actual no se cierra desde la lista', () {
      expect(_sesion('a', actual: true).puedeCerrarse, isFalse);
      expect(_sesion('b').puedeCerrarse, isTrue);
    });

    test('cuenta todas menos la actual', () {
      final sesiones = [_sesion('a', actual: true), _sesion('b'), _sesion('c')];
      expect(cuantasOtrasSesiones(sesiones), 2);
    });

    test('sin otras sesiones cuenta cero', () {
      expect(cuantasOtrasSesiones([_sesion('a', actual: true)]), 0);
      expect(cuantasOtrasSesiones(const []), 0);
    });
  });
}
