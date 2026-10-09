import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/sesion/presentation/elegir_rol_pagina.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

const _roles = [
  RolSesion(id: 'r1', nombre: 'Administrador'),
  RolSesion(id: 'r2', nombre: 'Guardia'),
];

const _eligiendo = SesionEligiendoRol(
  usuario: UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
  cuenta: CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
  roles: _roles,
);

void main() {
  testWidgets('lista los roles del usuario como opciones', (tester) async {
    final sesion = SesionFalsa(_eligiendo);
    await montarPantalla(
      tester,
      pagina: const ElegirRolPagina(),
      overrides: [sesionControladorProvider.overrideWith(() => sesion)],
    );
    await tester.pump();

    expect(find.text('Administrador'), findsOneWidget);
    expect(find.text('Guardia'), findsOneWidget);
  });

  testWidgets('elegir un rol lo activa en la sesión', (tester) async {
    final sesion = SesionFalsa(_eligiendo);
    await montarPantalla(
      tester,
      pagina: const ElegirRolPagina(),
      overrides: [sesionControladorProvider.overrideWith(() => sesion)],
    );
    await tester.pump();

    await tester.tap(find.text('Guardia'));
    await tester.pump();

    expect(sesion.rolesElegidos, ['r2']);
  });

  testWidgets('cerrar sesión desde aquí sale de la sesión', (tester) async {
    final sesion = SesionFalsa(_eligiendo);
    await montarPantalla(
      tester,
      pagina: const ElegirRolPagina(),
      overrides: [sesionControladorProvider.overrideWith(() => sesion)],
    );
    await tester.pump();
    final textos = AppLocalizations.of(
      tester.element(find.byType(Scaffold).first),
    );

    await tester.tap(find.text(textos.sesionCerrar));
    await tester.pump();

    expect(sesion.cierres, 1);
  });
}
