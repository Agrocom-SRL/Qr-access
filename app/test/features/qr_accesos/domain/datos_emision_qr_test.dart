import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final ahora = DateTime.utc(2026, 10, 9, 14, 30);

  group('DatosEmision.errorDe', () {
    test('sin puertas no hay QR que emitir', () {
      expect(
        DatosEmision.errorDe(puertaIds: {}, etiqueta: ''),
        ErrorDatosEmision.sinPuertas,
      );
    });

    test('una etiqueta de 60 caracteres es válida', () {
      expect(
        DatosEmision.errorDe(puertaIds: {'p1'}, etiqueta: 'a' * 60),
        isNull,
      );
    });

    test('una etiqueta de 61 caracteres es demasiado larga', () {
      expect(
        DatosEmision.errorDe(puertaIds: {'p1'}, etiqueta: 'a' * 61),
        ErrorDatosEmision.etiquetaLarga,
      );
    });

    test('los espacios del borde no cuentan para el largo', () {
      expect(
        DatosEmision.errorDe(puertaIds: {'p1'}, etiqueta: '  ${'a' * 60}  '),
        isNull,
      );
    });
  });

  group('DatosEmision', () {
    test('quita los espacios de la etiqueta', () {
      final datos = DatosEmision(
        puertaIds: const {'p1'},
        vigencia: OpcionVigencia.finDelDia,
        etiqueta: '  Proveedor de gas  ',
      );
      expect(datos.etiqueta, 'Proveedor de gas');
    });

    test('una etiqueta vacía se envía como ausente', () {
      final datos = DatosEmision(
        puertaIds: const {'p1'},
        vigencia: OpcionVigencia.finDelDia,
        etiqueta: '   ',
      );
      expect(datos.etiqueta, isNull);
    });

    test('conserva las puertas elegidas', () {
      final datos = DatosEmision(
        puertaIds: const {'p1', 'p2'},
        vigencia: OpcionVigencia.unaHora,
        etiqueta: '',
      );
      expect(datos.puertaIds, unorderedEquals(['p1', 'p2']));
    });
  });

  group('OpcionVigencia.venceAtPara', () {
    test('el fin del día lo calcula la API: la app no manda vence_at', () {
      expect(OpcionVigencia.finDelDia.venceAtPara(ahora), isNull);
    });

    test('una hora después de la emisión, en UTC', () {
      expect(
        OpcionVigencia.unaHora.venceAtPara(ahora),
        DateTime.utc(2026, 10, 9, 15, 30),
      );
    });

    test('cuatro horas después de la emisión, en UTC', () {
      expect(
        OpcionVigencia.cuatroHoras.venceAtPara(ahora),
        DateTime.utc(2026, 10, 9, 18, 30),
      );
    });

    test('una hora local se convierte a UTC antes de sumar', () {
      final local = DateTime.utc(2026, 10, 9, 14, 30).toLocal();
      expect(OpcionVigencia.unaHora.venceAtPara(local)?.isUtc, isTrue);
    });
  });
}
