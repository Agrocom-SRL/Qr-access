import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/data/perfil_repositorio.dart';
import 'package:agrocom_acceso/features/perfil/perfil.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/horizontal.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

void main() {
  testWidgets('Perfil en horizontal se desplaza y no desborda', (tester) async {
    await montarPantalla(
      tester,
      pagina: const PerfilPagina(),
      overrides: [
        sesionControladorProvider.overrideWith(() => SesionFalsa(sesionCon())),
        perfilRepositorioProvider.overrideWithValue(PerfilRepositorioFalso()),
        relojProvider.overrideWithValue(() => _ahora),
      ],
    );
    await tester.pump();
    usarHorizontal(tester);
    await tester.pumpAndSettle();
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(textos.perfilTitulo), findsWidgets);
    expect(find.text(textos.sesionCerrar), findsOneWidget);
  });
}
