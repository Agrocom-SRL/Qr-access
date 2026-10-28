import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/cabecera_cuenta.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pantalla.dart';
import '../../helpers/semantica.dart';

const _titulo = 'Hola, Jorge';
const _subtitulo = 'Agroindustrial Norte · Usuario';

Future<void> _montar(WidgetTester tester, CabeceraCuenta cabecera) =>
    montarPantalla(tester, pagina: Scaffold(body: cabecera));

void main() {
  testWidgets('muestra el avatar, el saludo y la línea de cuenta y rol', (
    tester,
  ) async {
    await _montar(
      tester,
      const CabeceraCuenta(
        titulo: _titulo,
        subtitulo: _subtitulo,
        etiquetaAvatar: 'Jorge Mamani',
      ),
    );

    expect(find.byType(AccesoAvatar), findsOneWidget);
    expect(find.text(_titulo), findsOneWidget);
    expect(find.text(_subtitulo), findsOneWidget);
  });

  testWidgets('sin alTocar no tiene semántica de botón ni responde al toque', (
    tester,
  ) async {
    final semantica = tester.ensureSemantics();
    await _montar(
      tester,
      const CabeceraCuenta(titulo: _titulo, subtitulo: _subtitulo),
    );

    expect(find.byType(InkWell), findsNothing);
    semantica.dispose();
  });

  testWidgets('con alTocar, el saludo lo llama y se anuncia con su etiqueta', (
    tester,
  ) async {
    final semantica = tester.ensureSemantics();
    var tocados = 0;
    await _montar(
      tester,
      CabeceraCuenta(
        titulo: _titulo,
        subtitulo: _subtitulo,
        alTocar: () => tocados++,
        etiquetaAlTocar: 'Perfil de prueba',
      ),
    );

    expect(textoSemanticoDe(tester, find.byType(InkWell)), 'Perfil de prueba');
    await tester.tap(find.text(_titulo));
    expect(tocados, 1);
    semantica.dispose();
  });

  testWidgets('la acción no lleva al perfil: tocarla no llama a alTocar', (
    tester,
  ) async {
    var tocados = 0;
    var accionesTocadas = 0;
    await _montar(
      tester,
      CabeceraCuenta(
        titulo: _titulo,
        subtitulo: _subtitulo,
        alTocar: () => tocados++,
        etiquetaAlTocar: 'Perfil de prueba',
        accion: IconButton(
          tooltip: 'Acción de prueba',
          onPressed: () => accionesTocadas++,
          icon: const Icon(Icons.notifications_none),
        ),
      ),
    );

    await tester.tap(find.byType(IconButton));
    expect(accionesTocadas, 1);
    expect(tocados, 0);
  });

  test('alTocar sin etiqueta falla en modo debug', () {
    expect(
      () => CabeceraCuenta(
        titulo: _titulo,
        subtitulo: _subtitulo,
        alTocar: () {},
      ),
      throwsAssertionError,
    );
  });
}
