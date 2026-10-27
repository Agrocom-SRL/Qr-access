import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/estructura_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/vista_apaisada.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/barra_navegacion.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const _roles = [
  Rol(id: 'r1', nombre: 'Administrador'),
  Rol(id: 'r2', nombre: 'Titular'),
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
];

final _puertas = [
  Puerta(
    id: 'p1',
    nombre: 'Portón vehicular',
    sitioId: 's1',
    sitioNombre: 'Condominio Norte',
    dispositivo: DispositivoDePuerta(
      id: 'd1',
      nombre: 'LECT-0042',
      enLinea: true,
      ultimoLatidoAt: _ahora.subtract(const Duration(seconds: 8)),
    ),
  ),
  const Puerta(
    id: 'p2',
    nombre: 'Acceso principal',
    sitioId: 's1',
    sitioNombre: 'Condominio Norte',
  ),
];

/// Lo que ve un Administrador de la cuenta: pestañas, cupo y estadísticas.
const Set<String> _administrador = {
  Permisos.supervisarPuertas,
  Permisos.administrarPuertas,
  Permisos.verUsuarios,
  Permisos.crearUsuarios,
  Permisos.editarUsuarios,
  Permisos.eliminarUsuarios,
  Permisos.verCupo,
  Permisos.verEstadisticas,
};

/// Monta Administración (con sus dos pestañas) con los datos de prueba.
Future<void> _montar(
  WidgetTester tester, {
  bool apaisada = false,
  bool expandida = false,
  Set<String> permisos = _administrador,
  List<Usuario>? usuarios,
}) async {
  await montarPantalla(
    tester,
    pagina: const AdministracionPagina(),
    apaisada: apaisada,
    expandida: expandida,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      usuariosRepositorioProvider.overrideWithValue(
        UsuariosRepositorioFalso(
          usuarios: usuarios ?? _usuarios,
          rolesDisponibles: _roles,
        ),
      ),
      estructuraRepositorioProvider.overrideWithValue(
        EstructuraRepositorioFalso(_sitios),
      ),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(_puertas),
      ),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
}

/// Cambia a una pestaña de Administración (solo cuando hay dos).
Future<void> _irA(WidgetTester tester, String etiqueta) async {
  await tester.tap(
    find.descendant(of: find.byType(TabBar), matching: find.text(etiqueta)),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('en horizontal de teléfono (852×393)', () {
    testWidgets(
      'Usuarios: el resumen va a la izquierda y la lista ocupa el alto',
      (tester) async {
        await _montar(tester, apaisada: true);
        await _irA(tester, textosEn(tester).navUsuarios);

        expect(tester.takeException(), isNull);
        expect(find.byType(VistaApaisada), findsOneWidget);
        expect(find.text(textosEn(tester).cupoTitulo), findsOneWidget);
        expect(find.text('Ana Pérez'), findsOneWidget);
        // La lista no es una rendija: tiene alto de sobra para sus tarjetas.
        expect(
          tester.getSize(find.byType(ListadoPaginado<Usuario>)).height,
          greaterThan(200),
        );
      },
    );

    testWidgets(
      'Usuarios: "Nuevo usuario" es el botón flotante, no un botón del resumen',
      (tester) async {
        await _montar(tester, apaisada: true);
        await _irA(tester, textosEn(tester).navUsuarios);

        expect(find.byType(FloatingActionButton), findsOneWidget);
        expect(find.text(textosEn(tester).usuariosNuevo), findsOneWidget);
        expect(
          find.widgetWithText(AccesoBoton, textosEn(tester).usuariosNuevo),
          findsNothing,
        );
      },
    );

    testWidgets('Usuarios: el resumen va en orden foto, cupo y actividad', (
      tester,
    ) async {
      await _montar(tester, apaisada: true);
      await _irA(tester, textosEn(tester).navUsuarios);
      final textos = textosEn(tester);

      final foto = tester.getTopLeft(find.byType(AccesoFoto)).dy;
      final cupo = tester.getTopLeft(find.text(textos.cupoTitulo)).dy;
      final actividad = tester
          .getTopLeft(find.text(textos.estadisticasTitulo))
          .dy;
      expect(foto, lessThan(cupo));
      expect(cupo, lessThan(actividad));
    });

    testWidgets(
      'Usuarios sin usuarios: el vacío no desborda y queda sobre el flotante',
      (tester) async {
        await _montar(tester, apaisada: true, usuarios: const []);
        await _irA(tester, textosEn(tester).navUsuarios);
        final textos = textosEn(tester);

        expect(tester.takeException(), isNull);
        final titulo = find.text(textos.usuariosSinUsuarios);
        await tester.ensureVisible(titulo);
        await tester.pump();
        expect(tester.takeException(), isNull);
        expect(titulo.hitTestable(), findsOneWidget);
        final boton = tester.getRect(find.byType(FloatingActionButton));
        expect(tester.getRect(titulo).bottom, lessThanOrEqualTo(boton.top));
      },
    );

    testWidgets('Puertas: "Gestionar" y la lista con toda la altura', (
      tester,
    ) async {
      await _montar(tester, apaisada: true);

      expect(tester.takeException(), isNull);
      expect(find.text(textosEn(tester).estructuraGestionar), findsOneWidget);
      expect(find.text('Portón vehicular'), findsOneWidget);
      expect(
        tester.getSize(find.byType(ListadoPaginado<Puerta>)).height,
        greaterThan(200),
      );
    });

    testWidgets('sin el permiso de gestionar, Puertas no ofrece "Gestionar"', (
      tester,
    ) async {
      await _montar(
        tester,
        apaisada: true,
        permisos: const {Permisos.supervisarPuertas},
      );

      expect(find.text(textosEn(tester).estructuraGestionar), findsNothing);
      expect(find.text('Portón vehicular'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('la barra inferior de navegación sigue visible', (
      tester,
    ) async {
      await _montar(tester, apaisada: true);

      expect(find.byType(BarraNavegacion), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('sin cambios fuera de horizontal', () {
    testWidgets(
      'en vertical (360×800) el resumen va sobre la lista, con botón flotante',
      (tester) async {
        await _montar(tester);
        await _irA(tester, textosEn(tester).navUsuarios);
        final textos = textosEn(tester);

        expect(find.byType(VistaApaisada), findsNothing);
        expect(find.byType(FloatingActionButton), findsOneWidget);
        expect(find.text(textos.usuariosNuevo), findsOneWidget);
        expect(find.text(textos.cupoTitulo), findsOneWidget);
      },
    );

    testWidgets('en vertical el resumen va en orden foto, cupo y actividad', (
      tester,
    ) async {
      await _montar(tester);
      await _irA(tester, textosEn(tester).navUsuarios);
      final textos = textosEn(tester);

      final foto = tester.getTopLeft(find.byType(AccesoFoto)).dy;
      final cupo = tester.getTopLeft(find.text(textos.cupoTitulo)).dy;
      final actividad = tester
          .getTopLeft(find.text(textos.estadisticasTitulo))
          .dy;
      expect(foto, lessThan(cupo));
      expect(cupo, lessThan(actividad));
    });

    testWidgets('en vertical el vacío queda sobre el botón flotante', (
      tester,
    ) async {
      await _montar(tester, usuarios: const []);
      await _irA(tester, textosEn(tester).navUsuarios);
      final textos = textosEn(tester);

      expect(tester.takeException(), isNull);
      final titulo = find.text(textos.usuariosSinUsuarios);
      await tester.ensureVisible(titulo);
      await tester.pump();
      final boton = tester.getRect(find.byType(FloatingActionButton));
      expect(tester.getRect(titulo).bottom, lessThanOrEqualTo(boton.top));
    });

    testWidgets('en tablet (800×1200) no usa la vista apaisada', (
      tester,
    ) async {
      await _montar(tester);
      usarTamano(tester, const Size(800, 1200));
      await tester.pumpAndSettle();

      expect(find.byType(VistaApaisada), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets(
      'una ventana de escritorio baja (web) no usa la vista apaisada',
      (tester) async {
        // La variable de plataforma se limpia en el cuerpo: un addTearDown
        // llega tarde y Flutter falla la verificación de invariantes.
        debugDefaultTargetPlatformOverride = TargetPlatform.linux;
        try {
          await _montar(tester, apaisada: true);

          expect(find.byType(VistaApaisada), findsNothing);
          expect(tester.takeException(), isNull);
        } finally {
          debugDefaultTargetPlatformOverride = null;
        }
      },
    );

    testWidgets('en expandido (1440×900) no usa la vista apaisada', (
      tester,
    ) async {
      await _montar(tester, expandida: true);

      expect(find.byType(VistaApaisada), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
