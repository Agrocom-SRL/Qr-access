import 'package:agrocom_acceso/core/l10n/idioma.dart';
import 'package:agrocom_acceso/core/l10n/idioma_controlador.dart';
import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/selector_idioma.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

void main() {
  group('resolverLocale', () {
    test('lo elegido manda sobre el dispositivo', () {
      expect(
        resolverLocale(Idioma.pt, const [Locale('en')]),
        const Locale('pt'),
      );
    });

    test('sin elección sigue al dispositivo si la app lo tiene', () {
      expect(
        resolverLocale(null, const [Locale('fr'), Locale('en', 'US')]),
        const Locale('en'),
      );
    });

    test('si el dispositivo no habla ninguno, usa el español', () {
      expect(resolverLocale(null, const [Locale('fr')]), const Locale('es'));
      expect(resolverLocale(null, null), const Locale('es'));
    });
  });

  group('IdiomaControlador', () {
    test('recuerda lo elegido y lo borra al volver al dispositivo', () async {
      final almacen = AlmacenPreferenciasFalso();
      final contenedor = ProviderContainer(
        overrides: [almacenPreferenciasProvider.overrideWithValue(almacen)],
      );
      addTearDown(contenedor.dispose);

      await contenedor.read(idiomaProvider.notifier).elegir(Idioma.en);
      expect(contenedor.read(idiomaProvider), Idioma.en);
      expect(await almacen.leer(clavePreferenciaIdioma), 'en');

      await contenedor.read(idiomaProvider.notifier).elegir(null);
      expect(contenedor.read(idiomaProvider), isNull);
      expect(await almacen.leer(clavePreferenciaIdioma), isNull);
    });

    test('restaura el idioma guardado', () async {
      final almacen = AlmacenPreferenciasFalso();
      await almacen.guardar(clavePreferenciaIdioma, 'pt');
      final contenedor = ProviderContainer(
        overrides: [almacenPreferenciasProvider.overrideWithValue(almacen)],
      );
      addTearDown(contenedor.dispose);

      contenedor.read(idiomaProvider);
      await Future<void>.delayed(Duration.zero);
      expect(contenedor.read(idiomaProvider), Idioma.pt);
    });
  });

  testWidgets('la fila de idioma abre la hoja y cambia el idioma', (
    tester,
  ) async {
    final almacen = AlmacenPreferenciasFalso();
    await montarPantalla(
      tester,
      pagina: const Scaffold(body: FilaIdioma()),
      overrides: [almacenPreferenciasProvider.overrideWithValue(almacen)],
    );
    await tester.pump();
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.perfilIdioma));
    await tester.pumpAndSettle();
    expect(find.text(textos.perfilIdiomaTitulo), findsOneWidget);
    for (final idioma in Idioma.values) {
      expect(find.text(idioma.nombre), findsWidgets);
    }

    await tester.tap(find.text(Idioma.pt.nombre).last);
    await tester.pumpAndSettle();
    expect(await almacen.leer(clavePreferenciaIdioma), 'pt');
  });
}
