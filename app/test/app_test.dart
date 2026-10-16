import 'package:agrocom_acceso/app.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/fakes.dart';
import 'helpers/pantalla.dart';

/// Integración de la raíz: la guarda de sesión decide la primera pantalla.
void main() {
  testWidgets('sin sesión, la app abre la bienvenida', (tester) async {
    usarTamano(tester, tamanoCompacto);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sesionControladorProvider.overrideWith(SesionFalsa.new),
          almacenPreferenciasProvider.overrideWithValue(
            AlmacenPreferenciasFalso(),
          ),
        ],
        child: const AccesoApp(),
      ),
    );
    await tester.pumpAndSettle();

    final textos = AppLocalizations.of(
      tester.element(find.byType(Scaffold).first),
    );
    expect(find.text(textos.bienvenidaFrase), findsOneWidget);
    expect(find.text(textos.sesionBotonIngresar), findsOneWidget);
  });

  testWidgets('con sesión, la bienvenida lleva al inicio', (tester) async {
    usarTamano(tester, tamanoCompacto);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sesionControladorProvider.overrideWith(
            () => SesionFalsa(
              sesionCon(permisos: {Permisos.emitirQr, Permisos.verQr}),
            ),
          ),
          almacenPreferenciasProvider.overrideWithValue(
            AlmacenPreferenciasFalso(),
          ),
          qrAccesosRepositorioProvider.overrideWithValue(
            QrAccesosRepositorioFalso(),
          ),
        ],
        child: const AccesoApp(),
      ),
    );
    await tester.pumpAndSettle();

    final textos = AppLocalizations.of(
      tester.element(find.byType(Scaffold).first),
    );
    expect(find.text(textos.inicioVigentesHoy), findsOneWidget);
    expect(find.text(textos.bienvenidaFrase), findsNothing);
  });
}
