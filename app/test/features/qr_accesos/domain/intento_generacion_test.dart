import 'dart:math';

import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/intento_generacion.dart';
import 'package:flutter_test/flutter_test.dart';

final _ahora = DateTime.utc(2026, 10, 26, 14, 30);

DatosGeneracion _datos({
  Set<String> puertaIds = const {'p1', 'p2'},
  Vigencia vigencia = const Vigencia(OpcionVigencia.dosHoras),
  String etiqueta = 'Entrada personal',
  DateTime? ahora,
}) => DatosGeneracion(
  puertaIds: puertaIds,
  vigencia: vigencia,
  etiqueta: etiqueta,
  ahora: ahora ?? _ahora,
  propio: true,
);

IntentoGeneracion _intento({DatosGeneracion? datos}) => IntentoGeneracion.nuevo(
  datos: datos ?? _datos(),
  ahora: _ahora,
  azar: Random(1),
);

void main() {
  group('IntentoGeneracion.nuevo', () {
    test('fija el vencimiento a partir de la primera petición', () {
      final intento = _intento();

      expect(intento.venceAt, DateTime.utc(2026, 10, 26, 16, 30));
    });

    test('deja el vencimiento a la API cuando es el fin del día', () {
      final intento = _intento(datos: _datos(vigencia: Vigencia.porDefecto));

      expect(intento.venceAt, isNull);
    });

    test('la generación y su reemplazo llevan claves distintas', () {
      final intento = _intento();

      expect(intento.clave, isNotEmpty);
      expect(intento.claveReemplazo, isNot(intento.clave));
    });
  });

  group('corresponde', () {
    test('es la misma acción aunque el reintento sea en otro momento', () {
      final intento = _intento();

      final reintento = _datos(ahora: _ahora.add(const Duration(minutes: 5)));

      expect(intento.corresponde(reintento), isTrue);
    });

    test('no es la misma si cambian las puertas', () {
      expect(_intento().corresponde(_datos(puertaIds: const {'p1'})), isFalse);
    });

    test('no es la misma si cambia la vigencia', () {
      final cuatroHoras = _datos(
        vigencia: const Vigencia(OpcionVigencia.cuatroHoras),
      );

      expect(_intento().corresponde(cuatroHoras), isFalse);
    });

    test('no es la misma si cambia la etiqueta', () {
      expect(_intento().corresponde(_datos(etiqueta: 'Otra')), isFalse);
    });

    test('no depende del orden de las puertas', () {
      final intento = _intento();

      expect(
        intento.corresponde(_datos(puertaIds: const {'p2', 'p1'})),
        isTrue,
      );
    });
  });

  group('haVencido', () {
    test('la clave vive 10 minutos y después ya no se reutiliza', () {
      final intento = _intento();

      expect(
        intento.haVencido(_ahora.add(const Duration(seconds: 599))),
        isFalse,
      );
      expect(
        intento.haVencido(_ahora.add(const Duration(seconds: 600))),
        isTrue,
      );
    });
  });
}
