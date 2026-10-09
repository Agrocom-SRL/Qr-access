import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/tiempo_restante.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/pantalla.dart';

void main() {
  final ahora = DateTime.utc(2026, 10, 9, 12);

  ({UnidadRestante unidad, int cantidad}) para(Duration resto) =>
      tiempoRestante(ahora.add(resto), ahora);

  test('desde 2 días, cuenta días (sin horas sueltas)', () {
    expect(para(const Duration(days: 7)), (
      unidad: UnidadRestante.dias,
      cantidad: 7,
    ));
    expect(para(const Duration(days: 2, hours: 23)), (
      unidad: UnidadRestante.dias,
      cantidad: 2,
    ));
  });

  test('con 1 día o menos, pasa a horas', () {
    expect(para(const Duration(days: 1, hours: 12)), (
      unidad: UnidadRestante.horas,
      cantidad: 36,
    ));
    expect(para(const Duration(hours: 5, minutes: 40)), (
      unidad: UnidadRestante.horas,
      cantidad: 5,
    ));
    expect(para(const Duration(hours: 1)), (
      unidad: UnidadRestante.horas,
      cantidad: 1,
    ));
  });

  test('con menos de 1 hora, pasa a minutos y nunca baja de 1', () {
    expect(para(const Duration(minutes: 59, seconds: 30)), (
      unidad: UnidadRestante.minutos,
      cantidad: 59,
    ));
    expect(para(const Duration(minutes: 20)), (
      unidad: UnidadRestante.minutos,
      cantidad: 20,
    ));
    expect(para(const Duration(seconds: 5)), (
      unidad: UnidadRestante.minutos,
      cantidad: 1,
    ));
  });

  testWidgets('muestra el texto en la unidad que corresponde, sin segundos', (
    tester,
  ) async {
    await montarPantalla(
      tester,
      pagina: Scaffold(
        body: TiempoRestante(venceAt: ahora.add(const Duration(days: 3))),
      ),
      overrides: [relojProvider.overrideWithValue(() => ahora)],
    );
    final textos = textosEn(tester);
    expect(find.text(textos.qrValidezDias(3)), findsOneWidget);
  });
}
