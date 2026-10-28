import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/dispositivos/data/sesiones_repositorio.dart';
import 'package:agrocom_acceso/features/dispositivos/dispositivos.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/horizontal.dart';
import '../../../helpers/pantalla.dart';
import '../../../helpers/sesiones_falsas.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

final _sesiones = [
  SesionConectada(
    id: 's1',
    plataforma: 'web',
    dispositivo: 'Notebook de Ana',
    ultimaActividadAt: _ahora,
    actual: true,
  ),
  SesionConectada(
    id: 's2',
    plataforma: 'ios',
    dispositivo: 'iPhone de Ana',
    ultimaActividadAt: _ahora.subtract(const Duration(hours: 3)),
    actual: false,
  ),
];

void main() {
  testWidgets('Dispositivos en horizontal se desplaza sin desbordar', (
    tester,
  ) async {
    await montarPantalla(
      tester,
      pagina: const DispositivosPagina(),
      overrides: [
        sesionControladorProvider.overrideWith(() => SesionFalsa(sesionCon())),
        sesionesRepositorioProvider.overrideWithValue(
          SesionesRepositorioFalso(sesiones: _sesiones),
        ),
        relojProvider.overrideWithValue(() => _ahora),
      ],
    );
    await tester.pump();
    await tester.pump();
    usarHorizontal(tester);
    await tester.pumpAndSettle();
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(textos.dispositivosAyuda), findsOneWidget);
    expect(find.text('Notebook de Ana'), findsWidgets);
  });
}
