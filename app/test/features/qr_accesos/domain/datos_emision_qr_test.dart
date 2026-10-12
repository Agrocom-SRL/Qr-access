import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final ahora = DateTime.utc(2026, 10, 9, 14, 30);

  ErrorDatosEmision? errorDe({
    Set<String> puertaIds = const {'p1'},
    String etiqueta = '',
    Vigencia vigencia = Vigencia.porDefecto,
  }) => DatosEmision.errorDe(
    puertaIds: puertaIds,
    etiqueta: etiqueta,
    vigencia: vigencia,
    ahora: ahora,
  );

  group('DatosEmision.errorDe', () {
    test('sin puertas no hay QR que emitir', () {
      expect(errorDe(puertaIds: {}), ErrorDatosEmision.sinPuertas);
    });

    test('una etiqueta de 40 caracteres es válida (handoff)', () {
      expect(errorDe(etiqueta: 'a' * 40), isNull);
    });

    test('una etiqueta de 41 caracteres es demasiado larga', () {
      expect(errorDe(etiqueta: 'a' * 41), ErrorDatosEmision.etiquetaLarga);
    });

    test('los espacios del borde no cuentan para el largo', () {
      expect(errorDe(etiqueta: '  ${'a' * 40}  '), isNull);
    });

    test('una hora exacta que ya pasó no vale', () {
      // Las 10:00 locales de hoy, con "ahora" a las 14:30 UTC (en cualquier
      // zona al oeste de UTC+4 ya pasó).
      final local = ahora.toLocal();
      final pasada = Vigencia(
        OpcionVigencia.horaExacta,
        minutosDelDia: (local.hour * 60 + local.minute) - 30,
      );
      expect(errorDe(vigencia: pasada), ErrorDatosEmision.vigenciaPasada);
    });
  });

  group('DatosEmision', () {
    test('quita los espacios de la etiqueta', () {
      final datos = DatosEmision(
        puertaIds: const {'p1'},
        vigencia: Vigencia.porDefecto,
        etiqueta: '  Proveedor de gas  ',
        ahora: ahora,
      );
      expect(datos.etiqueta, 'Proveedor de gas');
    });

    test('una etiqueta vacía se envía como ausente', () {
      final datos = DatosEmision(
        puertaIds: const {'p1'},
        vigencia: Vigencia.porDefecto,
        etiqueta: '   ',
        ahora: ahora,
      );
      expect(datos.etiqueta, isNull);
    });

    test('conserva las puertas elegidas', () {
      final datos = DatosEmision(
        puertaIds: const {'p1', 'p2'},
        vigencia: const Vigencia(OpcionVigencia.unaHora),
        etiqueta: '',
        ahora: ahora,
      );
      expect(datos.puertaIds, unorderedEquals(['p1', 'p2']));
    });
  });

  group('Vigencia.venceAtPara', () {
    test('por defecto son 2 horas desde la emisión', () {
      expect(Vigencia.porDefecto.opcion, OpcionVigencia.dosHoras);
      expect(
        Vigencia.porDefecto.venceAtPara(ahora),
        DateTime.utc(2026, 10, 9, 16, 30),
      );
    });

    test('todo el día lo calcula la API: la app no manda vence_at', () {
      expect(
        const Vigencia(OpcionVigencia.finDelDia).venceAtPara(ahora),
        isNull,
      );
    });

    test('los plazos largos llegan hasta las 24 horas', () {
      expect(
        const Vigencia(OpcionVigencia.veinticuatroHoras).venceAtPara(ahora),
        DateTime.utc(2026, 10, 10, 14, 30),
      );
    });

    test('los plazos en días cuentan 24 horas por día', () {
      expect(
        const Vigencia(OpcionVigencia.sieteDias).venceAtPara(ahora),
        DateTime.utc(2026, 10, 16, 14, 30),
      );
      expect(OpcionVigencia.enDias.map((o) => o.dias), [2, 3, 5, 7]);
    });

    test('los bloques de horas son 1, 2, 4, 8 y 12, 16, 20, 24', () {
      expect(OpcionVigencia.corta.map((o) => o.horas), [1, 2, 4, 8]);
      expect(OpcionVigencia.larga.map((o) => o.horas), [12, 16, 20, 24]);
    });

    test('una hora después de la emisión, en UTC', () {
      expect(
        const Vigencia(OpcionVigencia.unaHora).venceAtPara(ahora),
        DateTime.utc(2026, 10, 9, 15, 30),
      );
    });

    test('cuatro horas después de la emisión, en UTC', () {
      expect(
        const Vigencia(OpcionVigencia.cuatroHoras).venceAtPara(ahora),
        DateTime.utc(2026, 10, 9, 18, 30),
      );
    });

    test('una hora exacta es la hora local de hoy, en UTC', () {
      final local = ahora.toLocal();
      final vence = Vigencia(
        OpcionVigencia.horaExacta,
        minutosDelDia: local.hour * 60 + local.minute + 90,
      ).venceAtPara(ahora);
      expect(vence?.isUtc, isTrue);
      expect(vence, ahora.add(const Duration(minutes: 90)));
    });

    test('una hora local se convierte a UTC antes de sumar', () {
      final local = DateTime.utc(2026, 10, 9, 14, 30).toLocal();
      expect(
        const Vigencia(OpcionVigencia.unaHora).venceAtPara(local)?.isUtc,
        isTrue,
      );
    });
  });
}
