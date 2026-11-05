import 'dart:ui' show Tristate;

import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/apertura_manual/apertura_manual.dart';
import 'package:agrocom_acceso/features/apertura_manual/data/apertura_manual_repositorio.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_pulsador.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

const _principal = PuertaAbrible(
  id: 'p1',
  nombre: 'Portón principal',
  sitioNombre: 'Condominio Norte',
  habilitada: true,
  disponible: true,
  tienePlaca: true,
  enLinea: true,
);

const _lateral = PuertaAbrible(
  id: 'p2',
  nombre: 'Puerta lateral',
  sitioNombre: 'Condominio Norte',
  habilitada: true,
  disponible: true,
  tienePlaca: true,
  enLinea: false,
);

/// Repositorio con el shape de la API: la orden queda `pendiente` hasta que
/// el test decide cómo termina la consulta.
class _Repositorio implements AperturaManualRepositorio {
  new({this.consulta = EstadoOrden.entregada});

  final EstadoOrden consulta;
  final List<String> claves = [];

  @override
  Future<List<PuertaAbrible>> puertas() async => const [_principal, _lateral];

  @override
  Future<OrdenDeApertura> abrir(
    String puertaId, {
    required String claveIdempotencia,
  }) async {
    claves.add(claveIdempotencia);
    return OrdenDeApertura(
      id: 'o1',
      estado: EstadoOrden.pendiente,
      venceAt: DateTime.utc(2026, 11, 10, 15),
    );
  }

  @override
  Future<({EstadoOrden estado, DesenlaceDeApertura? desenlace})> estado(
    String ordenId,
  ) async => (estado: consulta, desenlace: null);

  @override
  Future<void> configurarPuerta(String puertaId, {required bool habilitada}) =>
      throw UnimplementedError();

  @override
  Future<void> configurarCuenta({required bool habilitada}) =>
      throw UnimplementedError();
}

Future<_Repositorio> _montar(
  WidgetTester tester, {
  required Size tamano,
  EstadoOrden consulta = EstadoOrden.entregada,
}) async {
  final repositorio = _Repositorio(consulta: consulta);
  await montarPantalla(
    tester,
    pagina: const AbrirPuertaPagina(),
    tamano: tamano,
    overrides: [
      aperturaManualRepositorioProvider.overrideWithValue(repositorio),
      sesionControladorProvider.overrideWith(() => SesionFalsa(sesionCon())),
    ],
  );
  // La lista de puertas llega en un futuro: dos vueltas bastan.
  await tester.pump();
  await tester.pump();
  return repositorio;
}

void main() {
  // Web y tablet: a 1280 px el pulsador no se estira ni se achica.
  for (final tamano in [tamanoCompacto, const Size(1280, 800)]) {
    testWidgets('muestra cada puerta con su pulsador y su texto, '
        'sin desbordes a ${tamano.width.toInt()} px', (tester) async {
      final semantics = tester.ensureSemantics();
      await _montar(tester, tamano: tamano);

      // El título de la pantalla y el texto bajo cada pulsador.
      expect(find.text('Abrir puerta'), findsNWidgets(3));
      expect(find.byType(AccesoPulsador), findsNWidgets(2));
      expect(
        tester.getSize(find.byType(AccesoPulsador).first),
        Size.square(const Tamanos().pulsadorArea),
      );
      expect(find.text('Sin conexión'), findsOneWidget);
      final boton = find.bySemanticsLabel('Abrir Portón principal');
      expect(
        tester.getSemantics(boton).getSemanticsData().flagsCollection.isButton,
        isTrue,
      );
      // La puerta sin placa en línea queda apagada y no responde.
      expect(
        tester
            .getSemantics(find.bySemanticsLabel('Abrir Puerta lateral'))
            .getSemanticsData()
            .flagsCollection
            .isEnabled,
        Tristate.isFalse,
      );
      semantics.dispose();
    });
  }

  testWidgets(
    'al pulsar, el pulsador va con anillo y el texto dice que se envía',
    (tester) async {
      final repositorio = await _montar(tester, tamano: tamanoCompacto);

      await tester.tap(find.bySemanticsLabel('Abrir Portón principal').first);
      await tester.pump();
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Abriendo Portón principal…'), findsOneWidget);
      expect(repositorio.claves, hasLength(1));
      // Mientras va en camino no se ofrece otra puerta.
      expect(find.text('Abrir otra puerta'), findsNothing);

      // Se deja correr la espera hasta el tope para que no queden timers.
      await tester.pump(const Duration(seconds: 10));
    },
  );

  testWidgets('cuando la placa toma la orden dice «enviada», no «abierta»', (
    tester,
  ) async {
    await _montar(tester, tamano: tamanoCompacto);

    await tester.tap(find.bySemanticsLabel('Abrir Portón principal').first);
    await tester.pump();
    await tester.pump();
    // La primera consulta (entregada) llega al cabo de un intervalo.
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();

    expect(find.text('Orden enviada a Portón principal'), findsOneWidget);
    expect(find.text('Portón principal abierta'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byType(AccesoPulsador), findsNothing);
    expect(find.text('Abrir otra puerta'), findsOneWidget);
  });

  testWidgets(
    'sin tomar la orden, a los 5 s dice que no se pudo contactar la puerta',
    (tester) async {
      await _montar(
        tester,
        tamano: tamanoCompacto,
        consulta: EstadoOrden.pendiente,
      );

      await tester.tap(find.bySemanticsLabel('Abrir Portón principal').first);
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 6));

      expect(find.text('No se pudo abrir Portón principal'), findsOneWidget);
      expect(
        find.text(
          'No se pudo contactar la puerta. '
          'Inténtalo de nuevo o entra con tu QR.',
        ),
        findsOneWidget,
      );
      expect(find.byType(CircularProgressIndicator), findsNothing);
    },
  );
}
