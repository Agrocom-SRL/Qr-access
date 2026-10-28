import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/sincronizacion/estado_sincronizacion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/linea_sincronizacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

Future<void> _montar(
  WidgetTester tester,
  EstadoSincronizacion estado, {
  Size? tamano,
}) => montarPantalla(
  tester,
  tamano: tamano,
  pagina: Scaffold(
    body: LineaSincronizacion(estado: estado, ahora: _ahora),
  ),
);

void main() {
  group('textoUltimaActualizacion', () {
    test(
      'hace menos de un minuto, o en el futuro, dice "un momento"',
      () async {
        final textos = await textosDe();

        expect(
          textoUltimaActualizacion(
            textos,
            _ahora.subtract(const Duration(seconds: 30)),
            _ahora,
          ),
          textos.comunSincronizacionMomento,
        );
        expect(
          textoUltimaActualizacion(
            textos,
            _ahora.add(const Duration(seconds: 5)),
            _ahora,
          ),
          textos.comunSincronizacionMomento,
        );
      },
    );

    test('en minutos, horas y, después de un día, la fecha', () async {
      final textos = await textosDe();

      expect(
        textoUltimaActualizacion(
          textos,
          _ahora.subtract(const Duration(minutes: 2)),
          _ahora,
        ),
        textos.comunSincronizacionMinutos(2),
      );
      expect(
        textoUltimaActualizacion(
          textos,
          _ahora.subtract(const Duration(hours: 3)),
          _ahora,
        ),
        textos.comunSincronizacionHoras(3),
      );

      final hace2Dias = _ahora.subtract(const Duration(days: 2));
      expect(
        textoUltimaActualizacion(textos, hace2Dias, _ahora),
        textos.comunSincronizacionFecha(formatearFechaHora(hace2Dias)),
      );
    });
  });

  testWidgets('sin actualización previa y sin pedido en curso no pinta nada', (
    tester,
  ) async {
    await _montar(tester, const EstadoSincronizacion());

    expect(find.byType(Text), findsNothing);
  });

  testWidgets('mientras actualiza muestra el indicador y su texto', (
    tester,
  ) async {
    await _montar(
      tester,
      EstadoSincronizacion(ultimaActualizacion: _ahora, actualizando: true),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      find.text(textosEn(tester).comunSincronizacionActualizando),
      findsOneWidget,
    );
  });

  testWidgets('sin conexión lo dice, en tono de advertencia', (tester) async {
    await _montar(
      tester,
      EstadoSincronizacion(ultimaActualizacion: _ahora, sinConexion: true),
    );

    final texto = tester.widget<Text>(
      find.text(textosEn(tester).comunSincronizacionSinConexion),
    );
    expect(texto.style?.color, isNotNull);
    expect(find.byIcon(Icons.cloud_off_outlined), findsOneWidget);
  });

  testWidgets('con una actualización a la vista dice cuánto hace, a 393×852 '
      'y a 852×393', (tester) async {
    await _montar(
      tester,
      EstadoSincronizacion(
        ultimaActualizacion: _ahora.subtract(const Duration(minutes: 5)),
      ),
      tamano: const Size(393, 852),
    );
    expect(
      find.text(textosEn(tester).comunSincronizacionMinutos(5)),
      findsOneWidget,
    );

    await _montar(
      tester,
      EstadoSincronizacion(
        ultimaActualizacion: _ahora.subtract(const Duration(minutes: 5)),
      ),
      tamano: const Size(852, 393),
    );
    expect(tester.takeException(), isNull);
    expect(
      find.text(textosEn(tester).comunSincronizacionMinutos(5)),
      findsOneWidget,
    );
  });
}
