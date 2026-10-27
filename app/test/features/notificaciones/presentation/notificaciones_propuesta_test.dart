import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/notificaciones_falsas.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

Notificacion _propuesta({bool aplicada = false, String? usuario = 'Jorge'}) =>
    Notificacion(
      id: '21',
      tipo: TipoNotificacion.propuestaIncidente,
      severidad: Severidad.aviso,
      cantidad: 1,
      leida: false,
      puertas: const [],
      sitio: null,
      usuario: usuario,
      novedadAt: _ahora,
      propuesta: PropuestaDeIncidente(
        accion: 'restringir',
        incidenteId: '7',
        confirmados: 3,
        minimo: 3,
        ventanaDias: 30,
        aplicadaAutomaticamente: aplicada,
      ),
    );

Future<void> _montar(
  WidgetTester tester, {
  required List<Notificacion> avisos,
  required Set<String> permisos,
  bool expandida = false,
}) async {
  await montarPantalla(
    tester,
    pagina: const NotificacionesPagina(),
    expandida: expandida,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
      notificacionesRepositorioProvider.overrideWithValue(
        NotificacionesRepositorioFalso(notificaciones: avisos),
      ),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
}

const Set<String> _conIncidentes = {
  Permisos.verNotificaciones,
  Permisos.gestionarNotificaciones,
  Permisos.verIncidentes,
};

void main() {
  testWidgets('la propuesta dice a quién se refiere, el paso y las cifras', (
    tester,
  ) async {
    await _montar(tester, avisos: [_propuesta()], permisos: _conIncidentes);
    final textos = textosEn(tester);

    expect(
      find.text(textos.notificacionTipoPropuestaIncidente),
      findsOneWidget,
    );
    expect(
      find.text(
        textos.notificacionDetallePropuesta(
          'Jorge',
          textos.incidenteAccionRestringir,
          3,
          3,
          30,
        ),
      ),
      findsOneWidget,
    );
  });

  testWidgets('si el sistema ya restringió, el aviso lo dice', (tester) async {
    await _montar(
      tester,
      avisos: [_propuesta(aplicada: true)],
      permisos: _conIncidentes,
    );

    expect(
      find.text(textosEn(tester).incidenteReincidenciaAplicada('Jorge')),
      findsOneWidget,
    );
  });

  testWidgets('sin nombre de usuario, la propuesta usa el texto genérico', (
    tester,
  ) async {
    await _montar(
      tester,
      avisos: [_propuesta(usuario: null)],
      permisos: _conIncidentes,
    );
    final textos = textosEn(tester);

    expect(
      find.text(
        textos.notificacionDetallePropuesta(
          textos.incidentesUsuarioSinNombre,
          textos.incidenteAccionRestringir,
          3,
          3,
          30,
        ),
      ),
      findsOneWidget,
    );
  });

  testWidgets('con verIncidentes, tocar la propuesta abre su incidente', (
    tester,
  ) async {
    await _montar(tester, avisos: [_propuesta()], permisos: _conIncidentes);

    await tester.tap(
      find.text(
        textosEn(tester).notificacionDetallePropuesta(
          'Jorge',
          textosEn(tester).incidenteAccionRestringir,
          3,
          3,
          30,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('destino /incidentes/7'), findsOneWidget);
  });

  testWidgets('sin verIncidentes, la propuesta no abre nada', (tester) async {
    await _montar(
      tester,
      avisos: [_propuesta()],
      permisos: {Permisos.verNotificaciones, Permisos.gestionarNotificaciones},
    );
    final textos = textosEn(tester);

    expect(find.byTooltip(textos.incidentesVer('Jorge')), findsNothing);
    await tester.tap(find.text(textos.notificacionTipoPropuestaIncidente));
    await tester.pumpAndSettle();

    expect(find.text('destino /incidentes/7'), findsNothing);
  });

  testWidgets('en expandido, la tabla trae Ver hacia el incidente', (
    tester,
  ) async {
    await montarPantalla(
      tester,
      pagina: const NotificacionesPagina(),
      expandida: true,
      overrides: [
        sesionControladorProvider.overrideWith(
          () => SesionFalsa(sesionCon(permisos: _conIncidentes)),
        ),
        notificacionesRepositorioProvider.overrideWithValue(
          NotificacionesRepositorioFalso(notificaciones: [_propuesta()]),
        ),
        relojProvider.overrideWithValue(() => _ahora),
      ],
    );
    await tester.pump();
    await tester.pump();

    expect(
      find.byTooltip(textosEn(tester).incidentesVer('Jorge')),
      findsOneWidget,
    );
  });
}
