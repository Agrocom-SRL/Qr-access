import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/notificaciones_falsas.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

const Set<String> _permisosDeBandeja = {
  Permisos.verNotificaciones,
  Permisos.gestionarNotificaciones,
};

final _avisos = [
  Notificacion(
    id: '1',
    tipo: TipoNotificacion.placaCaidaSostenida,
    severidad: Severidad.critica,
    cantidad: 1,
    leida: false,
    puertas: const ['Portón norte'],
    sitio: 'Sede Central',
    usuario: null,
    novedadAt: _ahora,
  ),
  Notificacion(
    id: '2',
    tipo: TipoNotificacion.senalUsoImposible,
    severidad: Severidad.aviso,
    cantidad: 1,
    leida: true,
    puertas: const [],
    sitio: null,
    usuario: 'Jorge',
    novedadAt: _ahora.subtract(const Duration(hours: 2)),
  ),
];

Future<NotificacionesRepositorioFalso> _montar(
  WidgetTester tester, {
  List<Notificacion> avisos = const [],
  int noLeidas = 0,
  Set<String> permisos = _permisosDeBandeja,
  NotificacionesRepositorioFalso? repositorio,
  bool expandida = false,
}) async {
  final repo =
      repositorio ??
      NotificacionesRepositorioFalso(
        notificaciones: avisos,
        noLeidas: noLeidas,
      );
  await montarPantalla(
    tester,
    pagina: const NotificacionesPagina(),
    expandida: expandida,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      notificacionesRepositorioProvider.overrideWithValue(repo),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return repo;
}

Future<void> _tocar(WidgetTester tester, Finder control) async {
  await tester.ensureVisible(control);
  await tester.tap(control);
}

void main() {
  testWidgets('lista los avisos con su tipo, su severidad y si ya se leyeron', (
    tester,
  ) async {
    await _montar(tester, avisos: _avisos, noLeidas: 1);
    final textos = textosEn(tester);

    expect(
      find.text(textos.notificacionTipoPlacaCaidaSostenida),
      findsOneWidget,
    );
    expect(find.text(textos.notificacionTipoSenalUsoImposible), findsOneWidget);
    expect(find.text(textos.notificacionSeveridadCritica), findsOneWidget);
    expect(find.text(textos.notificacionesNoLeida), findsOneWidget);
    expect(find.text(textos.notificacionesLeida), findsOneWidget);
    expect(
      find.text(textos.notificacionDetallePuertas('Portón norte')),
      findsOneWidget,
    );
    expect(
      find.text(textos.notificacionDetalleUsuario('Jorge')),
      findsOneWidget,
    );
  });

  testWidgets('el texto del servidor se muestra tal cual, nunca como formato', (
    tester,
  ) async {
    await _montar(
      tester,
      avisos: [
        Notificacion(
          id: '9',
          tipo: TipoNotificacion.placaRecuperada,
          severidad: Severidad.info,
          cantidad: 1,
          leida: false,
          puertas: const ['<b>Portón</b>'],
          sitio: null,
          usuario: null,
          novedadAt: _ahora,
        ),
      ],
    );

    expect(
      find.text(textosEn(tester).notificacionDetallePuertas('<b>Portón</b>')),
      findsOneWidget,
    );
  });

  testWidgets('marcar una leída la pide a la API y vuelve a cargar', (
    tester,
  ) async {
    final repo = await _montar(tester, avisos: _avisos, noLeidas: 1);
    final textos = textosEn(tester);

    await _tocar(tester, find.text(textos.notificacionesMarcarLeida).first);
    await tester.pump();
    await tester.pump();

    expect(repo.marcadas, ['1']);
  });

  testWidgets('sin el permiso de gestionar, no ofrece marcar nada', (
    tester,
  ) async {
    await _montar(
      tester,
      avisos: _avisos,
      noLeidas: 1,
      permisos: {Permisos.verNotificaciones},
    );

    expect(find.text(textosEn(tester).notificacionesMarcarLeida), findsNothing);
    expect(find.text(textosEn(tester).notificacionesLeerTodas), findsNothing);
  });

  testWidgets('el filtro de no leídas pide solo esas a la API', (tester) async {
    final repo = await _montar(tester, avisos: _avisos, noLeidas: 1);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.notificacionesFiltroNoLeidas));
    await tester.pump();
    await tester.pump();

    expect(repo.filtrosPedidos.last, isTrue);
    expect(find.text(textos.notificacionTipoSenalUsoImposible), findsNothing);
    expect(
      find.text(textos.notificacionTipoPlacaCaidaSostenida),
      findsOneWidget,
    );
  });

  testWidgets('marcar todas avisa cuántas marcó', (tester) async {
    final repo = await _montar(tester, avisos: _avisos, noLeidas: 1);
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.notificacionesLeerTodas));
    await tester.pump();
    await tester.pump();

    expect(repo.pedidosDeMarcarTodas, 1);
    expect(find.text(textos.notificacionesMarcadas(1)), findsOneWidget);
  });

  testWidgets('sin avisos sin leer no ofrece marcar todas', (tester) async {
    await _montar(tester, avisos: _avisos);

    expect(
      find.byTooltip(textosEn(tester).notificacionesLeerTodas),
      findsNothing,
    );
  });

  testWidgets('la bandeja vacía lo dice', (tester) async {
    await _montar(tester);

    expect(
      find.text(textosEn(tester).notificacionesSinNotificaciones),
      findsOneWidget,
    );
  });

  testWidgets('un error de la API al marcar se traduce por su código', (
    tester,
  ) async {
    await _montar(
      tester,
      avisos: _avisos,
      noLeidas: 1,
      repositorio: NotificacionesRepositorioFalso(
        notificaciones: _avisos,
        noLeidas: 1,
        errorMarcar: const ErrorApi(
          code: 'notificacion.no_encontrada',
          status: 404,
        ),
      ),
    );
    final textos = textosEn(tester);

    await _tocar(tester, find.text(textos.notificacionesMarcarLeida).first);
    await tester.pump();
    await tester.pump();

    expect(
      find.text(textos.comunErrorNotificacionNoEncontrada),
      findsOneWidget,
    );
  });

  testWidgets('sin conexión al cargar, lo dice con su título', (tester) async {
    await _montar(
      tester,
      repositorio: NotificacionesRepositorioFalso(
        errorListar: const ErrorApi(code: 'red.sin_conexion'),
      ),
    );

    expect(
      find.text(textosEn(tester).notificacionesErrorCargar),
      findsOneWidget,
    );
  });

  testWidgets('en expandido, la bandeja es una tabla', (tester) async {
    await _montar(tester, avisos: _avisos, noLeidas: 1, expandida: true);
    final textos = textosEn(tester);

    expect(find.text(textos.notificacionesColumnaSeveridad), findsOneWidget);
    expect(find.text(textos.notificacionesColumnaRecibida), findsOneWidget);
    expect(find.text(textos.notificacionSeveridadCritica), findsOneWidget);
  });

  testWidgets('el diálogo de confirmación no aparece al marcar leída', (
    tester,
  ) async {
    await _montar(tester, avisos: _avisos, noLeidas: 1);
    final textos = textosEn(tester);

    await _tocar(tester, find.text(textos.notificacionesMarcarLeida).first);
    await tester.pump();

    // Marcar leída no borra nada: no pide confirmación.
    expect(find.byType(ConfirmarDialogo), findsNothing);
  });
}
