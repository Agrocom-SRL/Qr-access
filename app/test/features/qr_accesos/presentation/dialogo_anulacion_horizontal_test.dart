import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/anulacion_masiva_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/anulacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/horizontal.dart';
import '../../../helpers/pantalla.dart';

/// Un botón que abre la confirmación, como lo hace la fila de Perfil.
class _Anfitrion extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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

void main() {
  testWidgets(
    'el diálogo de anulación en horizontal se desplaza sin desbordar',
    (tester) async {
      await montarPantalla(
        tester,
        pagina: const _Anfitrion(),
        overrides: [
          sesionControladorProvider.overrideWith(
            () => SesionFalsa(sesionCon(permisos: {Permisos.anularQrDeRama})),
          ),
          anulacionMasivaRepositorioProvider.overrideWithValue(
            AnulacionMasivaRepositorioFalso(),
          ),
        ],
      );
      await tester.pump();
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      usarHorizontal(tester);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    },
  );
}
