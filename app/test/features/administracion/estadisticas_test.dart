import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/estadisticas_usuarios.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 22, 14, 30);

const _inactivo = UsoDeUsuario(
  id: 'u3',
  etiqueta: 'Marta Soliz',
  rol: 'Miembro',
  unidad: null,
  qrGenerados: 0,
  qrUsados: 0,
  maxQrEnUnDia: 0,
  ultimoQrAt: null,
  inactivo: true,
  ruidoso: false,
);

final _inactivoConHistorial = UsoDeUsuario(
  id: 'u4',
  etiqueta: 'Luis Peña',
  rol: 'Guardia',
  unidad: null,
  qrGenerados: 0,
  qrUsados: 0,
  maxQrEnUnDia: 0,
  ultimoQrAt: DateTime.utc(2026, 9, 2, 15),
  inactivo: true,
  ruidoso: false,
);

const _ruidoso = UsoDeUsuario(
  id: 'u2',
  etiqueta: 'Jorge Rivero',
  rol: 'Titular',
  unidad: 'Casa 12',
  qrGenerados: 40,
  qrUsados: 2,
  maxQrEnUnDia: 14,
  ultimoQrAt: null,
  inactivo: false,
  ruidoso: true,
);

const _tranquilo = UsoDeUsuario(
  id: 'u5',
  etiqueta: 'Ana Pérez',
  rol: 'Miembro',
  unidad: null,
  qrGenerados: 5,
  qrUsados: 4,
  maxQrEnUnDia: 1,
  ultimoQrAt: null,
  inactivo: false,
  ruidoso: false,
);

EstadisticasDeUsuarios _datos({
  List<UsoDeUsuario> usuarios = const [],
  List<TitularConMiembros> titulares = const [],
}) => EstadisticasDeUsuarios(
  ventanaDias: 30,
  umbralInactivoDias: 30,
  umbralRuidosoPorDia: 10,
  usuarios: usuarios,
  titulares: titulares,
);

const _titularLleno = TitularConMiembros(
  id: 'u2',
  etiqueta: 'Jorge Rivero',
  unidad: 'Casa 12',
  miembros: 9,
  tope: 10,
  porcentaje: 90,
  cercaDelTope: true,
);

const _titularHolgado = TitularConMiembros(
  id: 'u6',
  etiqueta: 'Rosa Vaca',
  unidad: 'Casa 3',
  miembros: 1,
  tope: 10,
  porcentaje: 10,
  cercaDelTope: false,
);

const Set<String> _administrador = {
  Permisos.verUsuarios,
  Permisos.crearUsuarios,
  Permisos.editarUsuarios,
  Permisos.eliminarUsuarios,
  Permisos.verEstadisticas,
};

Future<UsuariosRepositorioFalso> _montar(
  WidgetTester tester, {
  required Widget pagina,
  EstadisticasDeUsuarios? estadisticas,
  Set<String> permisos = _administrador,
  Map<String, int> dependientes = const {},
  Exception? error,
  bool expandida = false,
}) async {
  final repositorio = UsuariosRepositorioFalso(
    usuarios: [
      Usuario(
        id: 'u3',
        etiqueta: 'Marta Soliz',
        activo: true,
        roles: const [Rol(id: 'r3', nombre: 'Miembro')],
        pinGeneradoAt: _ahora,
        ultimoIngresoAt: null,
        creadoAt: _ahora,
      ),
    ],
    estadisticasActuales:
        estadisticas ??
        _datos(
          usuarios: [_ruidoso, _inactivo, _inactivoConHistorial, _tranquilo],
          titulares: [_titularLleno, _titularHolgado],
        ),
    dependientes: dependientes,
    error: error,
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
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repositorio;
}

void main() {
  group('entrada desde Usuarios', () {
    testWidgets(
      'la tarjeta resume inactivos, ruidosos y Titulares cerca del tope',
      (tester) async {
        await _montar(tester, pagina: const UsuariosPagina());
        final textos = textosEn(tester);

        expect(find.text(textos.estadisticasTitulo), findsOneWidget);
        expect(find.text(textos.estadisticasResumen(2, 1, 1)), findsOneWidget);
      },
    );

    testWidgets('tocarla abre las estadísticas', (tester) async {
      await _montar(tester, pagina: const UsuariosPagina());

      await tester.tap(find.text(textosEn(tester).estadisticasTitulo));
      await tester.pumpAndSettle();

      expect(find.text('destino /admin/usuarios/estadisticas'), findsOneWidget);
    });

    testWidgets('sin el permiso de estadísticas no se ofrece', (tester) async {
      await _montar(
        tester,
        pagina: const UsuariosPagina(),
        permisos: {Permisos.verUsuarios},
      );
      expect(find.text(textosEn(tester).estadisticasTitulo), findsNothing);
    });
  });

  group('pantalla de estadísticas', () {
    testWidgets('explica que es informativa y con qué umbrales', (
      tester,
    ) async {
      await _montar(tester, pagina: const EstadisticasUsuariosPagina());

      expect(
        find.text(textosEn(tester).estadisticasAviso(30, 10)),
        findsOneWidget,
      );
    });

    testWidgets('arranca en los inactivos con su historial', (tester) async {
      await _montar(tester, pagina: const EstadisticasUsuariosPagina());
      final textos = textosEn(tester);

      expect(find.text('Marta Soliz'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Luis Peña'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Luis Peña'), findsOneWidget);
      // Nunca generó un QR vs. el último fue el 02/09/2026
      expect(
        find.text(textos.estadisticasDetalleNuncaGeneroQr(30)),
        findsOneWidget,
      );
      expect(find.textContaining('02/09/2026'), findsOneWidget);
      // Ni los ruidosos ni los tranquilos están en esta lista
      expect(find.text('Jorge Rivero'), findsNothing);
      expect(find.text('Ana Pérez'), findsNothing);
    });

    testWidgets('los conteos de las pastillas salen de la API', (tester) async {
      await _montar(tester, pagina: const EstadisticasUsuariosPagina());
      final textos = textosEn(tester);

      // La pastilla lleva la etiqueta y, al lado, su conteo
      Finder conteoDe(String etiqueta, String cifra) => find.descendant(
        of: find.widgetWithText(InkWell, etiqueta),
        matching: find.text(cifra),
      );
      expect(conteoDe(textos.estadisticasInactivos, '2'), findsOneWidget);
      expect(conteoDe(textos.estadisticasRuidosos, '1'), findsOneWidget);
      expect(conteoDe(textos.estadisticasTitulares, '1'), findsOneWidget);
    });

    testWidgets('Ruidosos muestra a quien generó más QR en un día', (
      tester,
    ) async {
      await _montar(tester, pagina: const EstadisticasUsuariosPagina());
      final textos = textosEn(tester);

      await tester.tap(find.text(textos.estadisticasRuidosos));
      await tester.pumpAndSettle();

      expect(find.text('Jorge Rivero'), findsOneWidget);
      expect(
        find.text(textos.estadisticasDetalleRuidoso(14, 40)),
        findsOneWidget,
      );
      expect(find.text('Marta Soliz'), findsNothing);
    });

    testWidgets('Titulares muestra solo a los que están cerca de su tope', (
      tester,
    ) async {
      await _montar(tester, pagina: const EstadisticasUsuariosPagina());
      final textos = textosEn(tester);

      await tester.tap(find.text(textos.estadisticasTitulares));
      await tester.pumpAndSettle();

      expect(
        find.text(textos.estadisticasTitularDetalle('Casa 12', 9, 10)),
        findsOneWidget,
      );
      expect(find.text('Rosa Vaca'), findsNothing);
    });

    testWidgets('sin casos, cada lista lo dice con un estado vacío', (
      tester,
    ) async {
      await _montar(
        tester,
        pagina: const EstadisticasUsuariosPagina(),
        estadisticas: _datos(
          usuarios: [_tranquilo],
          titulares: [_titularHolgado],
        ),
      );
      final textos = textosEn(tester);
      expect(find.text(textos.estadisticasSinInactivos), findsOneWidget);

      await tester.tap(find.text(textos.estadisticasRuidosos));
      await tester.pumpAndSettle();
      expect(find.text(textos.estadisticasSinRuidosos), findsOneWidget);

      await tester.tap(find.text(textos.estadisticasTitulares));
      await tester.pumpAndSettle();
      expect(find.text(textos.estadisticasSinTitulares), findsOneWidget);
    });

    testWidgets('si no carga, lo dice y deja reintentar', (tester) async {
      await _montar(
        tester,
        pagina: const EstadisticasUsuariosPagina(),
        error: const ErrorApi(code: ErrorApi.sinConexion),
      );
      final textos = textosEn(tester);

      expect(find.text(textos.comunErrorSinConexion), findsOneWidget);
    });
  });

  group('dar de baja desde las estadísticas', () {
    testWidgets('confirma y da de baja al inactivo', (tester) async {
      final repositorio = await _montar(
        tester,
        pagina: const EstadisticasUsuariosPagina(),
      );
      final textos = textosEn(tester);

      await tester.tap(find.text(textos.comunEliminar).first);
      await tester.pumpAndSettle();
      expect(
        find.text(textos.usuariosEliminarTitulo('Marta Soliz')),
        findsOneWidget,
      );
      expect(repositorio.eliminados, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, textos.comunEliminar));
      await tester.pumpAndSettle();

      expect(repositorio.eliminados, ['u3']);
    });

    testWidgets('cancelar no da de baja a nadie', (tester) async {
      final repositorio = await _montar(
        tester,
        pagina: const EstadisticasUsuariosPagina(),
      );
      final textos = textosEn(tester);

      await tester.tap(find.text(textos.comunEliminar).first);
      await tester.pumpAndSettle();
      await tester.tap(find.text(textos.comunCancelar));
      await tester.pumpAndSettle();

      expect(repositorio.eliminados, isEmpty);
    });

    testWidgets('un ruidoso con Miembros pide confirmar la cascada', (
      tester,
    ) async {
      final repositorio = await _montar(
        tester,
        pagina: const EstadisticasUsuariosPagina(),
        dependientes: const {'u2': 9},
      );
      final textos = textosEn(tester);

      await tester.tap(find.text(textos.estadisticasRuidosos));
      await tester.pumpAndSettle();
      await tester.tap(find.text(textos.comunEliminar).first);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, textos.comunEliminar));
      await tester.pumpAndSettle();

      expect(
        find.text(textos.usuariosEliminarCascadaMensaje(9)),
        findsOneWidget,
      );
      expect(repositorio.eliminados, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, textos.comunEliminar));
      await tester.pumpAndSettle();
      expect(repositorio.eliminadosEnCascada, ['u2']);
    });

    testWidgets('sin el permiso de eliminar no hay botón de baja', (
      tester,
    ) async {
      await _montar(
        tester,
        pagina: const EstadisticasUsuariosPagina(),
        permisos: {Permisos.verUsuarios, Permisos.verEstadisticas},
      );
      expect(find.text(textosEn(tester).comunEliminar), findsNothing);
    });
  });
}
