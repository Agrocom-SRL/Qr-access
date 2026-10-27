import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/anulacion_masiva_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/anulacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

/// Un botón que abre la confirmación, como lo hace la fila de Perfil.
class _Anfitrion extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Como en Perfil (SeccionSeguridad), alguien observa la anulación: el
    // controlador es autoDispose y no debe morir a mitad del envío.
    ref.watch(anulacionMasivaProvider);
    return Scaffold(
      body: Center(
        child: TextButton(
          onPressed: () => abrirAnulacionMasiva(context, ref),
          child: const Text('abrir'),
        ),
      ),
    );
  }
}

Future<AnulacionMasivaRepositorioFalso> _montar(
  WidgetTester tester, {
  AnulacionMasivaRepositorioFalso? repositorio,
}) async {
  final repo = repositorio ?? AnulacionMasivaRepositorioFalso();
  await montarPantalla(
    tester,
    pagina: const _Anfitrion(),
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.anularQrDeRama})),
      ),
      anulacionMasivaRepositorioProvider.overrideWithValue(repo),
    ],
  );
  await tester.pump();
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
  return repo;
}

Finder _confirmar(String texto) => find.widgetWithText(AccesoBoton, texto);

void main() {
  testWidgets('sin motivo, confirmar no hace nada', (tester) async {
    final repo = await _montar(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.qrAnulacionMiRamaTitulo), findsOneWidget);
    await tester.tap(_confirmar(textos.qrAnulacionMiRamaConfirmar));
    await tester.pumpAndSettle();

    expect(repo.motivos, isEmpty);
    expect(find.text(textos.qrAnulacionMiRamaTitulo), findsOneWidget);
  });

  testWidgets('cancelar cierra sin llamar a la API', (tester) async {
    final repo = await _montar(tester);
    final textos = textosEn(tester);

    await tester.enterText(find.byType(TextField), 'PIN filtrado');
    await tester.pump();
    await tester.tap(_confirmar(textos.comunCancelar));
    await tester.pumpAndSettle();

    expect(repo.motivos, isEmpty);
    expect(find.text(textos.qrAnulacionMiRamaTitulo), findsNothing);
  });

  testWidgets('con motivo, confirmar lo manda y dice cuántos QR se anularon', (
    tester,
  ) async {
    final repo = await _montar(
      tester,
      repositorio: AnulacionMasivaRepositorioFalso(),
    );
    final textos = textosEn(tester);

    await tester.enterText(find.byType(TextField), '  PIN filtrado  ');
    await tester.pump();
    await tester.tap(_confirmar(textos.qrAnulacionMiRamaConfirmar));
    await tester.pumpAndSettle();

    expect(repo.motivos, ['PIN filtrado']);
    expect(find.text(textos.qrAnulacionMiRamaResultado(3)), findsOneWidget);
  });

  testWidgets('un rechazo de la API se muestra traducido por su code', (
    tester,
  ) async {
    final repo = await _montar(
      tester,
      repositorio: AnulacionMasivaRepositorioFalso(
        error: const ErrorApi(
          code: 'anulacion.alcance_no_permitido',
          status: 403,
        ),
      ),
    );
    final textos = textosEn(tester);

    await tester.enterText(find.byType(TextField), 'PIN');
    await tester.pump();
    await tester.tap(_confirmar(textos.qrAnulacionMiRamaConfirmar));
    await tester.pumpAndSettle();

    expect(repo.motivos, ['PIN']);
    expect(
      find.text(textos.comunErrorAnulacionAlcanceNoPermitido),
      findsOneWidget,
    );
  });
}
