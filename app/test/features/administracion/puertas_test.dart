import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

final _puertas = [
  Puerta(
    id: 'p1',
    nombre: 'Portón vehicular',
    sitioId: 's1',
    sitioNombre: 'Planta Warnes',
    dispositivo: DispositivoDePuerta(
      id: 'd1',
      nombre: 'LECT-0042',
      enLinea: true,
      ultimoLatidoAt: _ahora.subtract(const Duration(seconds: 8)),
    ),
  ),
  Puerta(
    id: 'p2',
    nombre: 'Depósito 2',
    sitioId: 's1',
    sitioNombre: 'Planta Warnes',
    dispositivo: DispositivoDePuerta(
      id: 'd2',
      nombre: 'LECT-0051',
      enLinea: false,
      ultimoLatidoAt: _ahora.subtract(const Duration(hours: 2)),
    ),
  ),
  const Puerta(
    id: 'p3',
    nombre: 'Acceso principal',
    sitioId: 's2',
    sitioNombre: 'Oficina Equipetrol',
  ),
];

Future<void> _montar(
  WidgetTester tester, {
  required Widget pagina,
  Set<String> permisos = const {Permisos.supervisarPuertas},
  bool expandida = false,
}) async {
  await montarPantalla(
    tester,
    pagina: pagina,
    expandida: expandida,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(_puertas),
      ),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('agrupa por sitio y marca En línea / Sin conexión', (
    tester,
  ) async {
    await _montar(tester, pagina: const AdministracionPagina());
    final textos = textosEn(tester);

    expect(find.text('PLANTA WARNES'), findsOneWidget);
    expect(find.text('OFICINA EQUIPETROL'), findsOneWidget);
    expect(find.text('LECT-0042'), findsOneWidget);
    expect(find.text(textos.puertaEnLinea), findsOneWidget);
    expect(find.text(textos.puertaSinConexion), findsNWidgets(2));
    expect(find.text(textos.puertaSinLector), findsOneWidget);
  });

  testWidgets('el guardia no ve la pestaña Usuarios', (tester) async {
    await _montar(tester, pagina: const AdministracionPagina());
    expect(find.text(textosEn(tester).navUsuarios), findsNothing);
  });

  testWidgets('en expandido es una tabla con la última señal', (tester) async {
    await _montar(tester, pagina: const PuertasAdminPagina(), expandida: true);
    final textos = textosEn(tester);

    expect(find.byType(DataTable), findsOneWidget);
    expect(find.text(textos.comunHaceSegundos(8)), findsOneWidget);
    expect(find.text(textos.comunHaceHoras(2)), findsOneWidget);
    expect(find.text(textos.puertaNuncaReporto), findsOneWidget);
  });
}
