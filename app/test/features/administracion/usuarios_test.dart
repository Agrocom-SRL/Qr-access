import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const _roles = [
  Rol(id: 'r1', nombre: 'Administrador'),
  Rol(id: 'r2', nombre: 'Usuario'),
];

final _usuarios = [
  Usuario(
    id: 'u1',
    etiqueta: 'Ana Pérez',
    activo: true,
    roles: [_roles[0], _roles[1]],
    pinGeneradoAt: _ahora,
    ultimoIngresoAt: _ahora,
    creadoAt: _ahora,
  ),
  Usuario(
    id: 'u2',
    etiqueta: 'Jorge Rivero',
    activo: true,
    roles: [_roles[1]],
    pinGeneradoAt: _ahora,
    ultimoIngresoAt: null,
    creadoAt: _ahora,
  ),
];

const _pin = PinGenerado(
  pin: 'AGR7K2Q',
  usuarioEtiqueta: 'Jorge Rivero',
  roles: [Rol(id: 'r2', nombre: 'Usuario')],
  esNuevo: false,
);

const Set<String> _administrador = {
  Permisos.supervisarPuertas,
  Permisos.verUsuarios,
  Permisos.crearUsuarios,
  Permisos.editarUsuarios,
  Permisos.eliminarUsuarios,
};

Future<UsuariosRepositorioFalso> _montar(
  WidgetTester tester, {
  required Widget pagina,
  Set<String> permisos = _administrador,
  bool expandida = false,
  PinGenerado pin = _pin,
}) async {
  final repositorio = UsuariosRepositorioFalso(
    usuarios: _usuarios,
    rolesDisponibles: _roles,
    pinGenerado: pin,
  );
  await montarPantalla(
    tester,
    pagina: pagina,
    expandida: expandida,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      usuariosRepositorioProvider.overrideWithValue(repositorio),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(const []),
      ),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repositorio;
}

void main() {
  group('listado (C10b / E10b)', () {
    testWidgets('lista los usuarios con sus roles y la acción PIN', (
      tester,
    ) async {
      await _montar(tester, pagina: const UsuariosPagina());
      final textos = textosEn(tester);

      expect(find.text('Ana Pérez'), findsOneWidget);
      expect(find.text('Jorge Rivero'), findsOneWidget);
      expect(find.text('Administrador'), findsOneWidget);
      expect(find.text('Usuario'), findsNWidgets(2));
      expect(find.text(textos.usuariosPin), findsNWidgets(2));
    });

    testWidgets('Generar PIN confirma, regenera y muestra el PIN una vez', (
      tester,
    ) async {
      final repositorio = await _montar(tester, pagina: const UsuariosPagina());
      final textos = textosEn(tester);

      await tester.tap(find.text(textos.usuariosPin).last);
      await tester.pumpAndSettle();
      expect(find.text(textos.usuariosGenerarPinTitulo), findsOneWidget);

      await tester.tap(
        find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
      );
      await tester.pumpAndSettle();

      expect(repositorio.pinesRegenerados, ['u2']);
      // En compacto, el PIN se muestra a pantalla completa (C10c).
      expect(find.text('destino /admin/usuarios/pin'), findsOneWidget);
    });

    testWidgets('sin el permiso de editar no hay acción PIN', (tester) async {
      await _montar(
        tester,
        pagina: const UsuariosPagina(),
        permisos: {Permisos.verUsuarios},
      );
      expect(find.text(textosEn(tester).usuariosPin), findsNothing);
    });

    testWidgets(
      'en expandido, eliminar confirma y no se ofrece sobre uno mismo',
      (tester) async {
        final repositorio = await _montar(
          tester,
          pagina: const UsuariosPagina(),
          expandida: true,
        );
        final textos = textosEn(tester);

        expect(find.byType(DataTable), findsOneWidget);
        // u1 es la sesión actual: solo el otro usuario se puede eliminar.
        expect(find.byTooltip(textos.comunEliminar), findsOneWidget);

        await tester.ensureVisible(find.byTooltip(textos.comunEliminar));
        await tester.tap(find.byTooltip(textos.comunEliminar));
        await tester.pumpAndSettle();
        expect(
          find.text(textos.usuariosEliminarTitulo('Jorge Rivero')),
          findsOneWidget,
        );
        await tester.tap(
          find.widgetWithText(FilledButton, textos.comunEliminar),
        );
        await tester.pumpAndSettle();

        expect(repositorio.eliminados, ['u2']);
      },
    );

    testWidgets('en expandido, Generar PIN abre el diálogo con el PIN', (
      tester,
    ) async {
      await _montar(tester, pagina: const UsuariosPagina(), expandida: true);
      final textos = textosEn(tester);

      await tester.tap(find.text(textos.usuariosGenerarPin).last);
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
      );
      await tester.pumpAndSettle();

      expect(find.text(textos.usuariosPinGeneradoTitulo), findsOneWidget);
      expect(find.text(textos.comunCopiar), findsOneWidget);
      expect(find.textContaining('7K2Q'), findsOneWidget);
    });
  });

  group('formulario (nuevo usuario)', () {
    testWidgets('no genera sin etiqueta ni sin roles', (tester) async {
      final repositorio = await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(),
      );
      final textos = textosEn(tester);

      await tester.tap(
        find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
      );
      await tester.pump();
      expect(find.text(textos.usuariosErrorSinEtiqueta), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Jorge Rivero');
      await tester.tap(
        find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
      );
      await tester.pump();
      expect(find.text(textos.usuariosErrorSinRoles), findsOneWidget);
      expect(repositorio.creados, isEmpty);
    });

    testWidgets('con etiqueta y rol, crea y muestra el PIN', (tester) async {
      final repositorio = await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(),
        pin: const PinGenerado(
          pin: 'AGR7K2Q',
          usuarioEtiqueta: 'Jorge Rivero',
          roles: [Rol(id: 'r2', nombre: 'Usuario')],
          esNuevo: true,
        ),
      );
      final textos = textosEn(tester);

      await tester.enterText(find.byType(TextField), ' Jorge Rivero ');
      await tester.tap(find.text('Usuario'));
      await tester.pump();
      await tester.tap(
        find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
      );
      await tester.pumpAndSettle();

      expect(repositorio.creados.single.etiqueta, 'Jorge Rivero');
      expect(repositorio.creados.single.rolIds, ['r2']);
      expect(find.text('destino /admin/usuarios/pin'), findsOneWidget);
    });
  });

  group('PIN generado (C10c)', () {
    testWidgets(
      'muestra el PIN partido en cuenta y clave, con la advertencia',
      (tester) async {
        await montarPantalla(
          tester,
          pagina: const PinGeneradoPagina(pin: _pin),
        );
        await tester.pump();
        final textos = textosEn(tester);

        expect(find.text('Jorge Rivero'), findsOneWidget);
        expect(find.textContaining('7K2Q'), findsOneWidget);
        expect(
          find.bySemanticsLabel(textos.usuariosPinSemantica('AGR7K2Q')),
          findsOneWidget,
        );
        expect(
          find.text(textos.usuariosPinAvisoRegenerado('Jorge')),
          findsOneWidget,
        );

        await tester.tap(find.text(textos.usuariosPinListo));
        await tester.pumpAndSettle();
        expect(find.text('destino /admin/usuarios'), findsOneWidget);
      },
    );
  });
}
