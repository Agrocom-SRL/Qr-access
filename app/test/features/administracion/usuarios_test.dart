import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/estructura_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/cupo.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const _roles = [
  Rol(id: 'r1', nombre: 'Administrador'),
  Rol(id: 'r2', nombre: 'Titular'),
  Rol(id: 'r3', nombre: 'Miembro'),
  Rol(id: 'r4', nombre: 'Guardia'),
];

final _usuarios = [
  Usuario(
    id: 'u1',
    etiqueta: 'Ana Pérez',
    activo: true,
    roles: [_roles[0]],
    pinGeneradoAt: _ahora,
    ultimoIngresoAt: _ahora,
    creadoAt: _ahora,
  ),
  Usuario(
    id: 'u2',
    etiqueta: 'Jorge Rivero',
    activo: true,
    roles: [_roles[1]],
    unidad: const UnidadUsuario(id: 'n1', nombre: 'Casa 12', sitioId: 's1'),
    pinGeneradoAt: _ahora,
    ultimoIngresoAt: null,
    creadoAt: _ahora,
  ),
];

const _sitios = [
  SitioGestionado(
    id: 's1',
    nombre: 'Condominio Norte',
    direccion: null,
    puertas: [],
  ),
  SitioGestionado(id: 's2', nombre: 'Feria Sur', direccion: null, puertas: []),
];

const _pin = PinGenerado(
  pin: 'AGR7K2Q',
  usuarioEtiqueta: 'Jorge Rivero',
  roles: [Rol(id: 'r2', nombre: 'Titular')],
  esNuevo: false,
);

const Set<String> _administrador = {
  Permisos.supervisarPuertas,
  Permisos.verUsuarios,
  Permisos.crearUsuarios,
  Permisos.editarUsuarios,
  Permisos.eliminarUsuarios,
  Permisos.verCupo,
};

Future<UsuariosRepositorioFalso> _montar(
  WidgetTester tester, {
  required Widget pagina,
  Set<String> permisos = _administrador,
  bool expandida = false,
  PinGenerado pin = _pin,
  PuertasAsignadas asignadas = const PuertasAsignadas(),
  Map<String, int> dependientes = const {},
  Cupo? cupo,
  RolSesion rol = rolDePrueba,
}) async {
  final repositorio = UsuariosRepositorioFalso(
    usuarios: _usuarios,
    rolesDisponibles: _roles,
    pinGenerado: pin,
    asignadas: asignadas,
    dependientes: dependientes,
    cupoActual:
        cupo ??
        const Cupo(
          usados: 4,
          maximo: 10,
          porcentaje: 40,
          aviso: null,
          maxMiembrosPorTitular: 10,
        ),
  );
  await montarPantalla(
    tester,
    pagina: pagina,
    expandida: expandida,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos, rol: rol)),
      ),
      usuariosRepositorioProvider.overrideWithValue(repositorio),
      estructuraRepositorioProvider.overrideWithValue(
        EstructuraRepositorioFalso(_sitios),
      ),
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
    testWidgets('lista los usuarios con su rol, su unidad y la acción PIN', (
      tester,
    ) async {
      await _montar(tester, pagina: const UsuariosPagina());
      final textos = textosEn(tester);

      expect(find.text('Ana Pérez'), findsOneWidget);
      expect(find.text('Jorge Rivero'), findsOneWidget);
      expect(find.text('Administrador'), findsOneWidget);
      expect(find.text('Titular'), findsOneWidget);
      expect(find.text('Casa 12'), findsOneWidget);
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

    testWidgets(
      'Generar PIN con los 4 caracteres elegidos los envía en mayúsculas',
      (tester) async {
        final repositorio = await _montar(
          tester,
          pagina: const UsuariosPagina(),
        );
        final textos = textosEn(tester);

        await tester.tap(find.text(textos.usuariosPin).last);
        await tester.pumpAndSettle();
        await tester.tap(find.byType(Switch));
        await tester.pumpAndSettle();

        // Un sufijo corto no se envía.
        await tester.enterText(find.byType(TextField), 'ab1');
        await tester.tap(
          find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
        );
        await tester.pump();
        expect(find.text(textos.usuariosPinSufijoError), findsOneWidget);
        expect(repositorio.pinesRegenerados, isEmpty);

        await tester.enterText(find.byType(TextField), 'ab12');
        await tester.tap(
          find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
        );
        await tester.pumpAndSettle();
        expect(repositorio.sufijosPedidos, ['AB12']);
      },
    );

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
      expect(find.text(textos.usuariosPinCompartir), findsOneWidget);
      expect(find.textContaining('7K2Q'), findsOneWidget);
    });
  });

  group('formulario (nuevo usuario)', () {
    testWidgets('no genera sin etiqueta ni sin rol', (tester) async {
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

    testWidgets('el Administrador solo puede dar Titular y Guardia', (
      tester,
    ) async {
      await _montar(tester, pagina: const UsuarioFormularioPagina());

      expect(find.text('Titular'), findsOneWidget);
      expect(find.text('Guardia'), findsOneWidget);
      expect(find.text('Miembro'), findsNothing);
      expect(find.text('Administrador'), findsNothing);
    });

    testWidgets('un Titular solo puede dar Miembro', (tester) async {
      await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(),
        rol: const RolSesion(id: 'r2', nombre: 'Titular'),
      );

      expect(find.text('Miembro'), findsOneWidget);
      expect(find.text('Titular'), findsNothing);
      expect(find.text('Guardia'), findsNothing);
    });

    testWidgets('un Miembro o un Guardia no crean a nadie', (tester) async {
      await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(),
        rol: const RolSesion(id: 'r4', nombre: 'Guardia'),
      );

      expect(
        find.text(textosEn(tester).usuariosSinRolesParaCrear),
        findsOneWidget,
      );
    });

    testWidgets('con etiqueta y un Guardia, crea sin unidad y muestra el PIN', (
      tester,
    ) async {
      final repositorio = await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(),
        pin: const PinGenerado(
          pin: 'AGR7K2Q',
          usuarioEtiqueta: 'Portería',
          roles: [Rol(id: 'r4', nombre: 'Guardia')],
          esNuevo: true,
        ),
      );
      final textos = textosEn(tester);

      await tester.enterText(find.byType(TextField), ' Portería ');
      await tester.tap(find.text('Guardia'));
      await tester.pump();
      // Un Guardia no lleva unidad
      expect(
        find.text(textos.usuariosSeccionUnidad.toUpperCase()),
        findsNothing,
      );
      await tester.tap(
        find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
      );
      await tester.pumpAndSettle();

      expect(repositorio.creados.single.etiqueta, 'Portería');
      expect(repositorio.creados.single.rolId, 'r4');
      expect(repositorio.creados.single.unidad, isNull);
      expect(find.text('destino /admin/usuarios/pin'), findsOneWidget);
    });

    testWidgets('un Titular pide propiedad y nombre de unidad antes de crear', (
      tester,
    ) async {
      final repositorio = await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(),
        pin: const PinGenerado(
          pin: 'AGR7K2Q',
          usuarioEtiqueta: 'Jorge Rivero',
          roles: [Rol(id: 'r2', nombre: 'Titular')],
          esNuevo: true,
        ),
      );
      final textos = textosEn(tester);
      Future<void> generar() async {
        await tester.ensureVisible(
          find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
        );
        await tester.tap(
          find.widgetWithText(FilledButton, textos.usuariosGenerarPin),
        );
        await tester.pump();
      }

      await tester.enterText(find.byType(TextField).first, 'Jorge Rivero');
      await tester.tap(find.text('Titular'));
      await tester.pump();
      expect(
        find.text(textos.usuariosSeccionUnidad.toUpperCase()),
        findsOneWidget,
      );

      await generar();
      expect(find.text(textos.usuariosErrorSinPropiedad), findsOneWidget);

      final selector = find.byType(DropdownButtonFormField<String>);
      await tester.ensureVisible(selector);
      await tester.pumpAndSettle();
      await tester.tap(selector);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Feria Sur').last);
      await tester.pumpAndSettle();
      await generar();
      expect(find.text(textos.usuariosErrorSinNombreUnidad), findsOneWidget);
      expect(repositorio.creados, isEmpty);

      await tester.enterText(find.byType(TextField).last, ' Puesto 7 ');
      await generar();
      await tester.pumpAndSettle();

      final creado = repositorio.creados.single;
      expect(creado.rolId, 'r2');
      expect(creado.unidad?.sitioId, 's2');
      expect(creado.unidad?.nombre, 'Puesto 7');
      expect(find.text('destino /admin/usuarios/pin'), findsOneWidget);
    });

    testWidgets('cambiar de Titular a Guardia descarta la unidad', (
      tester,
    ) async {
      await _montar(tester, pagina: const UsuarioFormularioPagina());
      final textos = textosEn(tester);

      await tester.tap(find.text('Titular'));
      await tester.pump();
      expect(
        find.text(textos.usuariosSeccionUnidad.toUpperCase()),
        findsOneWidget,
      );
      await tester.tap(find.text('Guardia'));
      await tester.pump();
      expect(
        find.text(textos.usuariosSeccionUnidad.toUpperCase()),
        findsNothing,
      );
    });
  });

  group('formulario (editar usuario)', () {
    testWidgets('muestra el rol y la unidad sin poder cambiarlos', (
      tester,
    ) async {
      await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(usuarioId: 'u2'),
      );
      final textos = textosEn(tester);

      expect(find.text('Titular'), findsOneWidget);
      expect(find.text('Casa 12'), findsOneWidget);
      expect(find.byType(Radio<String>), findsNothing);
      expect(
        find.text(textos.usuariosSeccionUnidad.toUpperCase()),
        findsOneWidget,
      );
    });

    testWidgets('guarda solo el nombre', (tester) async {
      final repositorio = await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(usuarioId: 'u2'),
      );
      final textos = textosEn(tester);

      await tester.enterText(find.byType(TextField), '  Jorge R. ');
      await tester.tap(find.widgetWithText(FilledButton, textos.comunGuardar));
      await tester.pumpAndSettle();

      expect(repositorio.editados.single, ('u2', 'Jorge R.'));
    });
  });

  group('baja en cascada (ADR 0028 §7)', () {
    testWidgets('un Titular con Miembros pide confirmar cuántos caen', (
      tester,
    ) async {
      final repositorio = await _montar(
        tester,
        pagina: const UsuariosPagina(),
        expandida: true,
        dependientes: const {'u2': 3},
      );
      final textos = textosEn(tester);

      await tester.ensureVisible(find.byTooltip(textos.comunEliminar));
      await tester.tap(find.byTooltip(textos.comunEliminar));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, textos.comunEliminar));
      await tester.pumpAndSettle();

      // La API respondió 409: se muestra cuántos caen antes de seguir
      expect(
        find.text(textos.usuariosEliminarCascadaMensaje(3)),
        findsOneWidget,
      );
      expect(repositorio.eliminados, isEmpty);

      await tester.tap(find.widgetWithText(FilledButton, textos.comunEliminar));
      await tester.pumpAndSettle();
      expect(repositorio.eliminados, ['u2']);
      expect(repositorio.eliminadosEnCascada, ['u2']);
    });

    testWidgets('si no confirma la cascada, no se da de baja a nadie', (
      tester,
    ) async {
      final repositorio = await _montar(
        tester,
        pagina: const UsuariosPagina(),
        expandida: true,
        dependientes: const {'u2': 1},
      );
      final textos = textosEn(tester);

      await tester.ensureVisible(find.byTooltip(textos.comunEliminar));
      await tester.tap(find.byTooltip(textos.comunEliminar));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, textos.comunEliminar));
      await tester.pumpAndSettle();
      await tester.tap(find.text(textos.comunCancelar));
      await tester.pumpAndSettle();

      expect(repositorio.eliminados, isEmpty);
    });
  });

  group('cupo (ADR 0028 §6)', () {
    testWidgets('el Administrador ve el uso del cupo de la cuenta', (
      tester,
    ) async {
      await _montar(tester, pagina: const UsuariosPagina());
      final textos = textosEn(tester);

      expect(find.text(textos.cupoTitulo), findsOneWidget);
      expect(find.text(textos.cupoUsados(4, 10)), findsOneWidget);
      expect(find.text(textos.cupoMaximoMiembros(10)), findsOneWidget);
      expect(find.text(textos.cupoAvisoCerca), findsNothing);
    });

    testWidgets('al 80 % avisa y al 100 % avisa que no se pueden crear más', (
      tester,
    ) async {
      await _montar(
        tester,
        pagina: const UsuariosPagina(),
        cupo: const Cupo(
          usados: 8,
          maximo: 10,
          porcentaje: 80,
          aviso: AvisoCupo.cercaDelLimite,
          maxMiembrosPorTitular: 10,
        ),
      );
      expect(find.text(textosEn(tester).cupoAvisoCerca), findsOneWidget);
    });

    testWidgets('en el límite, el aviso es el de límite alcanzado', (
      tester,
    ) async {
      await _montar(
        tester,
        pagina: const UsuariosPagina(),
        cupo: const Cupo(
          usados: 10,
          maximo: 10,
          porcentaje: 100,
          aviso: AvisoCupo.limiteAlcanzado,
          maxMiembrosPorTitular: 10,
        ),
      );
      expect(find.text(textosEn(tester).cupoAvisoLimite), findsOneWidget);
    });

    testWidgets('sin límite en el plan no hay barra ni aviso', (tester) async {
      await _montar(
        tester,
        pagina: const UsuariosPagina(),
        cupo: const Cupo(
          usados: 40,
          maximo: null,
          porcentaje: null,
          aviso: null,
          maxMiembrosPorTitular: 10,
        ),
      );
      expect(find.text(textosEn(tester).cupoSinLimite(40)), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
    });

    testWidgets('quien no tiene el permiso del cupo no lo ve', (tester) async {
      await _montar(
        tester,
        pagina: const UsuariosPagina(),
        permisos: {Permisos.verUsuarios, Permisos.crearUsuarios},
      );
      expect(find.text(textosEn(tester).cupoTitulo), findsNothing);
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

  group('puertas asignadas (guardias)', () {
    testWidgets(
      'al editar, asignar todas las puertas se guarda con el usuario',
      (tester) async {
        final repositorio = await _montar(
          tester,
          pagina: const UsuarioFormularioPagina(usuarioId: 'u2'),
          permisos: {..._administrador, Permisos.asignarGuardias},
        );
        final textos = textosEn(tester);

        await tester.scrollUntilVisible(
          find.text(textos.usuariosPuertasTodas),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text(textos.usuariosPuertasTodas));
        await tester.pump();
        await tester.tap(
          find.widgetWithText(FilledButton, textos.comunGuardar),
        );
        await tester.pumpAndSettle();

        expect(repositorio.asignaciones.single.$1, 'u2');
        expect(repositorio.asignaciones.single.$2.todas, isTrue);
      },
    );

    testWidgets('sin el permiso de asignar no se ofrece la sección', (
      tester,
    ) async {
      await _montar(
        tester,
        pagina: const UsuarioFormularioPagina(usuarioId: 'u2'),
      );
      expect(find.text(textosEn(tester).usuariosSeccionPuertas), findsNothing);
    });
  });
}
