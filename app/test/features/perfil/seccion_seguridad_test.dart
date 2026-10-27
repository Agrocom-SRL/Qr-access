import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/data/perfil_repositorio.dart';
import 'package:agrocom_acceso/features/perfil/perfil.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

Future<void> _montar(
  WidgetTester tester, {
  required Set<String> permisos,
}) async {
  await montarPantalla(
    tester,
    pagina: const PerfilPagina(),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      almacenPreferenciasProvider.overrideWithValue(AlmacenPreferenciasFalso()),
      perfilRepositorioProvider.overrideWithValue(PerfilRepositorioFalso()),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
}

void main() {
  testWidgets('con los tres permisos, Seguridad y datos ofrece sus filas', (
    tester,
  ) async {
    await _montar(
      tester,
      permisos: {
        Permisos.verIncidentes,
        Permisos.anularQrDeRama,
        Permisos.exportarDatos,
      },
    );
    final textos = textosEn(tester);

    expect(find.text(textos.perfilSeguridadTitulo), findsOneWidget);
    expect(find.text(textos.perfilIncidentes), findsOneWidget);
    expect(find.text(textos.perfilAnularMiRama), findsOneWidget);
    expect(find.text(textos.perfilExportar), findsOneWidget);
  });

  testWidgets('sin permisos de seguridad, la sección no aparece', (
    tester,
  ) async {
    await _montar(tester, permisos: {Permisos.verQr});
    final textos = textosEn(tester);

    expect(find.text(textos.perfilSeguridadTitulo), findsNothing);
    expect(find.text(textos.perfilIncidentes), findsNothing);
    expect(find.text(textos.perfilAnularMiRama), findsNothing);
    expect(find.text(textos.perfilExportar), findsNothing);
  });

  testWidgets('solo verIncidentes muestra la fila de incidentes', (
    tester,
  ) async {
    await _montar(tester, permisos: {Permisos.verIncidentes});
    final textos = textosEn(tester);

    expect(find.text(textos.perfilSeguridadTitulo), findsOneWidget);
    expect(find.text(textos.perfilIncidentes), findsOneWidget);
    expect(find.text(textos.perfilAnularMiRama), findsNothing);
    expect(find.text(textos.perfilExportar), findsNothing);
  });

  testWidgets('solo exportarDatos no muestra la anulación ni incidentes', (
    tester,
  ) async {
    await _montar(tester, permisos: {Permisos.exportarDatos});
    final textos = textosEn(tester);

    expect(find.text(textos.perfilExportar), findsOneWidget);
    expect(find.text(textos.perfilIncidentes), findsNothing);
    expect(find.text(textos.perfilAnularMiRama), findsNothing);
  });

  testWidgets('la fila de incidentes lleva a la lista', (tester) async {
    await _montar(tester, permisos: {Permisos.verIncidentes});
    final textos = textosEn(tester);

    await tester.ensureVisible(find.text(textos.perfilIncidentes));
    await tester.tap(find.text(textos.perfilIncidentes));
    await tester.pumpAndSettle();

    expect(find.text('destino /incidentes'), findsOneWidget);
  });

  testWidgets('la fila de exportación lleva a la exportación', (tester) async {
    await _montar(tester, permisos: {Permisos.exportarDatos});
    final textos = textosEn(tester);

    await tester.ensureVisible(find.text(textos.perfilExportar));
    await tester.tap(find.text(textos.perfilExportar));
    await tester.pumpAndSettle();

    expect(find.text('destino /exportar'), findsOneWidget);
  });
}
