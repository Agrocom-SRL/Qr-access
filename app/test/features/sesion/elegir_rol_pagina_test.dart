import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/sesion/presentation/elegir_rol_pagina.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

const _roles = [
  RolSesion(id: 'r1', nombre: 'Administrador'),
  RolSesion(id: 'r2', nombre: 'Guardia'),
];

const _eligiendo = SesionEligiendoRol(
  usuario: usuarioDePrueba,
  cuenta: cuentaDePrueba,
  roles: _roles,
  rolPreferidoId: 'r2',
);

Future<SesionFalsa> _montar(WidgetTester tester) async {
  final sesion = SesionFalsa(_eligiendo);
  await montarPantalla(
    tester,
    pagina: const ElegirRolPagina(),
    overrides: [sesionControladorProvider.overrideWith(() => sesion)],
  );
  await tester.pump();
  return sesion;
}

void main() {
  testWidgets('lista los roles como tarjetas con su descripción', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    expect(find.text('Administrador'), findsOneWidget);
    expect(find.text('Guardia'), findsOneWidget);
    expect(find.text(textos.rolDescripcionAdministrador), findsOneWidget);
    expect(find.text(textos.rolDescripcionGuardia), findsOneWidget);
    expect(
      find.text(textos.perfilCuentaYCodigo('Demo', 'AGR')),
      findsOneWidget,
    );
  });

  testWidgets('Continuar activa el rol preseleccionado (el último usado)', (
    tester,
  ) async {
    final sesion = await _montar(tester);

    await tester.tap(find.text(textosEn(tester).comunContinuar));
    await tester.pump();

    expect(sesion.rolesElegidos, ['r2']);
  });

  testWidgets('elegir otra tarjeta y continuar activa ese rol', (tester) async {
    final sesion = await _montar(tester);

    await tester.tap(find.text('Administrador'));
    await tester.pump();
    await tester.tap(find.text(textosEn(tester).comunContinuar));
    await tester.pump();

    expect(sesion.rolesElegidos, ['r1']);
  });

  testWidgets('cerrar sesión desde aquí sale de la sesión', (tester) async {
    final sesion = await _montar(tester);

    await tester.tap(find.text(textosEn(tester).sesionCerrar));
    await tester.pump();

    expect(sesion.cierres, 1);
  });
}
