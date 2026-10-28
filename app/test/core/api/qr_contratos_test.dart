import 'package:agrocom_acceso/core/api/contratos/qr_contratos.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _respuesta({String? texto, bool? reutilizado}) => {
  'id': 'qr1',
  'texto': ?texto,
  'reutilizado': ?reutilizado,
  'vence_at': '2026-10-26T23:59:00.000Z',
  'etiqueta': null,
  'puertas': [
    {'id': 'p1', 'nombre': 'Portón'},
  ],
};

void main() {
  group('QrGeneradoDto', () {
    test('un QR nuevo (201) trae su token y no es reutilizado', () {
      final dto = QrGeneradoDto.desde(
        _respuesta(texto: 'AQ1.abc', reutilizado: false),
      );

      expect(dto.texto, 'AQ1.abc');
      expect(dto.reutilizado, isFalse);
      expect(dto.id, 'qr1');
    });

    test(
      'un QR reutilizado (200) llega con texto null, sin romper el parseo',
      () {
        final dto = QrGeneradoDto.desde(_respuesta(reutilizado: true));

        expect(dto.texto, isNull);
        expect(dto.reutilizado, isTrue);
        expect(dto.venceAt, DateTime.utc(2026, 10, 26, 23, 59));
        expect(dto.puertas.single.nombre, 'Portón');
      },
    );

    test('sin el campo reutilizado se toma como no reutilizado', () {
      final dto = QrGeneradoDto.desde(_respuesta(texto: 'AQ1.abc'));

      expect(dto.reutilizado, isFalse);
    });
  });
}
