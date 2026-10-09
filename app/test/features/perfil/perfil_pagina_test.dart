import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tema_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/perfil.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

Future<({SesionFalsa sesion, AlmacenPreferenciasFalso preferencias})> _montar(
  WidgetTester tester, {
  SuscripcionSesion? suscripcion,
  List<RolSesion> roles = const [rolDePrueba],
}) async {
  final sesion = SesionFalsa(sesionCon(roles: roles, suscripcion: suscripcion));
  final preferencias = AlmacenPreferenciasFalso();
  await montarPantalla(
    tester,
    pagina: const PerfilPagina(),
    overrides: [
      sesionControladorProvider.overrideWith(() => sesion),
      almacenPreferenciasProvider.overrideWithValue(preferencias),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  return (sesion: sesion, preferencias: preferencias);
}

void main() {
  testWidgets('muestra quién soy, la cuenta, el plan y el rol activo', (
    tester,
  ) async {
    await _montar(
      tester,
      suscripcion: SuscripcionSesion(
        plan: 'Empresa',
        hasta: DateTime.utc(2027, 3, 31),
      ),
    );
    final textos = textosEn(tester);

    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text(textos.perfilPinDeCuenta('AGR')), findsOneWidget);
    expect(find.text('Demo'), findsOneWidget);
    expect(find.text('AGR'), findsOneWidget);
    expect(find.textContaining('Empresa'), findsOneWidget);
    expect(find.text('Administrador'), findsOneWidget);
    expect(find.text(textos.perfilVersion), findsOneWidget);
  });

  testWidgets('sin suscripción vigente lo avisa', (tester) async {
    await _montar(tester);
    expect(find.text(textosEn(tester).perfilSinSuscripcion), findsNWidgets(2));
  });

  testWidgets('con un solo rol no ofrece cambiar; con varios, sí', (
    tester,
  ) async {
    await _montar(tester);
    expect(find.text(textosEn(tester).perfilCambiarRol), findsNothing);
  });

  testWidgets('Cambiar rol pide volver a elegir', (tester) async {
    final (:sesion, preferencias: _) = await _montar(
      tester,
      roles: const [
        rolDePrueba,
        RolSesion(id: 'r2', nombre: 'Usuario'),
      ],
    );
    await tester.tap(find.text(textosEn(tester).perfilCambiarRol));
    await tester.pump();
    expect(sesion.cambiosDeRolPedidos, 1);
  });

  testWidgets('el interruptor de tema guarda la preferencia', (tester) async {
    final (sesion: _, :preferencias) = await _montar(tester);

    await tester.tap(find.byType(Switch));
    await tester.pump();

    expect(preferencias.valores[clavePreferenciaTema], ThemeMode.dark.name);
  });

  testWidgets('Cerrar sesión llama al controlador', (tester) async {
    final (:sesion, preferencias: _) = await _montar(tester);
    // Con la fila de idioma, el botón queda bajo la barra en 360×800.
    final cerrar = find.text(textosEn(tester).sesionCerrar);
    await tester.ensureVisible(cerrar);
    await tester.pump();
    await tester.tap(cerrar);
    await tester.pump();
    expect(sesion.cierres, 1);
  });
}
