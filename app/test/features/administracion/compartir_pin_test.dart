import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_texto.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

const _pin = PinGenerado(
  usuarioId: 'u2',
  pin: 'AGR7K2Q',
  usuarioEtiqueta: 'Jorge Rivero',
  roles: [Rol(id: 'r2', nombre: 'Titular')],
  esNuevo: true,
);

Future<({UsuariosRepositorioFalso repositorio, CompartirTextoFalso compartir})>
_montar(
  WidgetTester tester, {
  PinGenerado pin = _pin,
  ResultadoCompartir resultado = ResultadoCompartir.compartido,
  Exception? error,
}) async {
  final repositorio = UsuariosRepositorioFalso(error: error);
  final compartir = CompartirTextoFalso(resultado);
  await montarPantalla(
    tester,
    pagina: PinGeneradoPagina(pin: pin),
    overrides: [
      usuariosRepositorioProvider.overrideWithValue(repositorio),
      compartirTextoProvider.overrideWithValue(compartir),
    ],
  );
  await tester.pump();
  return (repositorio: repositorio, compartir: compartir);
}

void main() {
  testWidgets('avisa que el PIN pasa por una aplicación de terceros', (
    tester,
  ) async {
    await _montar(tester);
    expect(
      find.text(textosEn(tester).usuariosPinAvisoCompartir),
      findsOneWidget,
    );
  });

  testWidgets('Compartir manda el PIN por el menú del sistema y lo registra', (
    tester,
  ) async {
    final (:repositorio, :compartir) = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.usuariosPinCompartir));
    await tester.pumpAndSettle();

    expect(
      compartir.enviados.single,
      textos.usuariosPinMensajeCompartir('AGR7K2Q'),
    );
    expect(compartir.enviados.single, contains('AGR7K2Q'));
    // Queda anotado el envío: el id es el del usuario dueño del PIN
    expect(repositorio.pinesCompartidos, ['u2']);
  });

  testWidgets(
    'si la persona cierra el menú sin compartir, no se registra nada',
    (tester) async {
      final (:repositorio, :compartir) = await _montar(
        tester,
        resultado: ResultadoCompartir.cancelado,
      );

      await tester.tap(find.text(textosEn(tester).usuariosPinCompartir));
      await tester.pumpAndSettle();

      expect(compartir.enviados, hasLength(1));
      expect(repositorio.pinesCompartidos, isEmpty);
    },
  );

  testWidgets(
    'si el registro falla, el PIN ya salió y la pantalla sigue en pie',
    (tester) async {
      final (:repositorio, :compartir) = await _montar(
        tester,
        error: const ErrorApi(code: ErrorApi.sinConexion),
      );

      await tester.tap(find.text(textosEn(tester).usuariosPinCompartir));
      await tester.pumpAndSettle();

      expect(compartir.enviados, hasLength(1));
      expect(repositorio.pinesCompartidos, isEmpty);
      expect(tester.takeException(), isNull);
      expect(find.textContaining('7K2Q'), findsWidgets);
    },
  );

  testWidgets('un PIN sin usuario conocido se comparte pero no se registra', (
    tester,
  ) async {
    final (:repositorio, :compartir) = await _montar(
      tester,
      pin: const PinGenerado(
        pin: 'AGR7K2Q',
        usuarioEtiqueta: 'Jorge Rivero',
        roles: [Rol(id: 'r2', nombre: 'Titular')],
        esNuevo: true,
      ),
    );

    await tester.tap(find.text(textosEn(tester).usuariosPinCompartir));
    await tester.pumpAndSettle();

    expect(compartir.enviados, hasLength(1));
    expect(repositorio.pinesCompartidos, isEmpty);
  });

  testWidgets('Compartir es la única forma de sacar el PIN: no hay Copiar', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.usuariosPinCompartir), findsOneWidget);
    expect(find.text('Copiar'), findsNothing);
    expect(find.byIcon(Icons.content_copy_outlined), findsNothing);
  });

  testWidgets(
    'sin menú de compartir el PIN queda copiado, se avisa y se registra',
    (tester) async {
      final (:repositorio, :compartir) = await _montar(
        tester,
        resultado: ResultadoCompartir.copiado,
      );

      await tester.tap(find.text(textosEn(tester).usuariosPinCompartir));
      await tester.pumpAndSettle();

      expect(compartir.enviados, hasLength(1));
      expect(
        find.text(textosEn(tester).usuariosPinCopiadoParaCompartir),
        findsOneWidget,
      );
      // Salió de la app por el portapapeles: también cuenta como compartido
      expect(repositorio.pinesCompartidos, ['u2']);
    },
  );
}
