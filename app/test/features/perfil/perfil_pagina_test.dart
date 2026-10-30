import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/data/perfil_repositorio.dart';
import 'package:agrocom_acceso/features/perfil/perfil.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/cabecera_titulo.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

Future<({SesionFalsa sesion, AlmacenPreferenciasFalso preferencias})> _montar(
  WidgetTester tester, {
  SuscripcionSesion? suscripcion,
  PerfilRepositorioFalso? perfil,
}) async {
  final sesion = SesionFalsa(sesionCon(suscripcion: suscripcion));
  final preferencias = AlmacenPreferenciasFalso();
  await montarPantalla(
    tester,
    pagina: const PerfilPagina(),
    overrides: [
      sesionControladorProvider.overrideWith(() => sesion),
      almacenPreferenciasProvider.overrideWithValue(preferencias),
      perfilRepositorioProvider.overrideWithValue(
        perfil ?? PerfilRepositorioFalso(),
      ),
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
    // Ajustes, incidentes y demás cuelgan del menú, no de la página.
    expect(find.text(textos.perfilAcercaTitulo), findsNothing);
    expect(find.text(textos.perfilDispositivos), findsNothing);
  });

  testWidgets('no lleva título de pantalla: empieza por el usuario', (
    tester,
  ) async {
    await _montar(tester);

    expect(find.byType(CabeceraTitulo), findsNothing);
    expect(
      tester.getTopLeft(find.text('Ana Pérez')).dy,
      lessThan(tester.getTopLeft(find.text(textosEn(tester).sesionCerrar)).dy),
    );
  });

  testWidgets('sin suscripción vigente lo avisa', (tester) async {
    await _montar(tester);
    expect(find.text(textosEn(tester).perfilSinSuscripcion), findsNWidgets(2));
  });

  testWidgets('muestra el rol del usuario y no ofrece cambiarlo (ADR 0028)', (
    tester,
  ) async {
    await _montar(tester);
    expect(find.text(textosEn(tester).perfilRolActivo), findsOneWidget);
    expect(find.text(rolDePrueba.nombre), findsWidgets);
  });

  testWidgets('Cerrar sesión llama al controlador', (tester) async {
    final (:sesion, preferencias: _) = await _montar(tester);
    final cerrar = find.text(textosEn(tester).sesionCerrar);
    await tester.ensureVisible(cerrar);
    await tester.pump();
    await tester.tap(cerrar);
    await tester.pump();
    expect(sesion.cierres, 1);
  });

  testWidgets('cada persona edita su nombre; sin cambios no se envía nada', (
    tester,
  ) async {
    final perfil = PerfilRepositorioFalso();
    await _montar(tester, perfil: perfil);
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.perfilEditarNombre));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '   ');
    await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
    await tester.pump();
    expect(find.text(textos.perfilNombreError), findsOneWidget);

    await tester.enterText(find.byType(TextField), ' Ana María ');
    await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
    await tester.pumpAndSettle();
    expect(perfil.nombres, ['Ana María']);

    // Mismo nombre que el actual: se cierra sin llamar a la API.
    await tester.tap(find.byTooltip(textos.perfilEditarNombre));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
    await tester.pumpAndSettle();
    expect(perfil.nombres, hasLength(1));
  });
}
