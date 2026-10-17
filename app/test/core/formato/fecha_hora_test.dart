import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // 02:30 UTC del 10 de octubre son las 22:30 del 9 en Bolivia (UTC-4).
  final instante = DateTime.utc(2026, 10, 10, 2, 30);

  test(
    'muestra siempre la hora de Bolivia, sin importar la zona del equipo',
    () {
      expect(formatearHora(instante), '22:30');
      expect(formatearFecha(instante), '09/10/2026');
      expect(formatearFechaHora(instante), '09/10/2026 22:30');
    },
  );

  test('el día cambia a medianoche de Bolivia, no de UTC', () {
    final antes = DateTime.utc(2026, 10, 10, 3, 59); // 23:59 del 9
    final despues = DateTime.utc(2026, 10, 10, 4); // 00:00 del 10
    expect(mismoDiaLocal(antes, despues), isFalse);
    expect(mismoDiaLocal(instante, antes), isTrue);
  });

  test('instanteDesdeBolivia invierte horaBolivia', () {
    final hora = horaBolivia(instante);
    final vuelta = instanteDesdeBolivia(
      hora.year,
      hora.month,
      hora.day,
      hora.hour,
      hora.minute,
    );
    expect(vuelta, instante);
  });
}
