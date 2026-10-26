import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/qr_rapido_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/visor_qr.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

final _generado = QrGenerado(
  id: 'qr1',
  texto: 'AQ1.token',
  venceAt: DateTime.utc(2026, 10, 9, 16, 30),
  etiqueta: 'Entrada para Ana',
  puertas: const [PuertaDeQr(id: 'p1', nombre: 'Portón principal')],
);

const _puertas = [
  Puerta(
    id: 'p1',
    nombre: 'Portón principal',
    sitioId: 's1',
    sitioNombre: 'Sede',
  ),
  Puerta(id: 'p2', nombre: 'Depósito', sitioId: 's1', sitioNombre: 'Sede'),
];

Future<QrAccesosRepositorioFalso> _montar(
  WidgetTester tester, {
  List<Puerta> puertas = _puertas,
  Exception? errorGenerar,
  QrGenerado? respaldo,
  QrGenerado? reanudado,
  Exception? errorReanudar,
}) async {
  final repositorio = QrAccesosRepositorioFalso(
    generado: _generado,
    errorGenerar: errorGenerar,
    respaldo: respaldo,
    reanudado: reanudado,
    errorReanudar: errorReanudar,
  );
  await montarPantalla(
    tester,
    pagina: const QrRapidoPagina(),
    overrides: [
      qrAccesosRepositorioProvider.overrideWithValue(repositorio),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(puertas),
      ),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.generarQrPropio})),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
  // El Lottie de generación dura 1 s y el QR entra en 300 ms.
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(milliseconds: 16));
  await tester.pumpAndSettle();
  return repositorio;
}

void main() {
  testWidgets('genera sin formulario: todas las puertas y 2 horas', (
    tester,
  ) async {
    final repositorio = await _montar(tester);

    final generacion = repositorio.generaciones.single;
    expect(generacion.puertaIds, ['p1', 'p2']);
    expect(generacion.vigencia.opcion, OpcionVigencia.finDelDia);
    expect(generacion.etiqueta, isNotNull);
    expect(find.byType(VisorQr), findsOneWidget);
  });

  testWidgets('no se puede compartir y cerrar no pide confirmación', (
    tester,
  ) async {
    await _montar(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.qrCompartir), findsNothing);
    expect(find.text(textos.qrRapidoAviso), findsOneWidget);
    await tester.tap(find.text(textos.qrRapidoListo));
    await tester.pumpAndSettle();
    expect(find.text('destino /inicio'), findsOneWidget);
  });

  testWidgets('sin puertas, lo dice y no genera', (tester) async {
    final repositorio = await _montar(tester, puertas: const []);
    final textos = textosEn(tester);

    expect(repositorio.generaciones, isEmpty);
    expect(find.text(textos.qrGenerarSinPuertas), findsOneWidget);
  });

  testWidgets('si la API falla, ofrece reintentar', (tester) async {
    final repositorio = await _montar(
      tester,
      errorGenerar: const ErrorApi(code: ErrorApi.sinConexion),
    );
    final textos = textosEn(tester);

    expect(find.byType(VisorQr), findsNothing);
    expect(find.text(textos.qrRapidoError), findsOneWidget);
    repositorio.errorGenerar = null;
    await tester.tap(find.text(textos.comunReintentar));
    await tester.pump();
    await tester.pump();
    expect(repositorio.generaciones, hasLength(2));
  });

  testWidgets('sin internet muestra el último QR propio guardado', (
    tester,
  ) async {
    await _montar(
      tester,
      errorGenerar: const ErrorApi(code: ErrorApi.sinConexion),
      respaldo: QrGenerado(
        id: 'qr0',
        texto: 'AQ1.respaldo',
        venceAt: _generado.venceAt,
        etiqueta: 'Entrada para Ana',
        puertas: _generado.puertas,
        respaldo: true,
      ),
    );
    final textos = textosEn(tester);

    expect(find.byType(VisorQr), findsOneWidget);
    expect(find.text(textos.qrRapidoRespaldoAviso), findsOneWidget);
    expect(find.text(textos.qrRapidoError), findsNothing);
  });

  testWidgets('un error distinto de sin conexión no usa el respaldo', (
    tester,
  ) async {
    await _montar(
      tester,
      errorGenerar: const ErrorApi(code: 'servidor.error'),
      respaldo: _generado,
    );

    expect(find.byType(VisorQr), findsNothing);
  });

  group('reabrir Mi QR', () {
    testWidgets('con su QR vigente lo muestra y no genera ningún otro', (
      tester,
    ) async {
      final repositorio = await _montar(tester, reanudado: _generado);

      expect(repositorio.generaciones, isEmpty);
      expect(repositorio.reanudaciones.single, ['p1', 'p2']);
      expect(find.byType(VisorQr), findsOneWidget);
    });

    testWidgets('si el guardado ya no vale, genera uno nuevo', (tester) async {
      final repositorio = await _montar(tester);

      expect(repositorio.reanudaciones.single, ['p1', 'p2']);
      expect(repositorio.generaciones, hasLength(1));
      expect(find.byType(VisorQr), findsOneWidget);
    });

    testWidgets('sin red muestra el respaldo y no genera', (tester) async {
      final repositorio = await _montar(
        tester,
        errorReanudar: const ErrorApi(code: ErrorApi.sinConexion),
        respaldo: QrGenerado(
          id: 'qr1',
          texto: 'AQ1.respaldo',
          venceAt: _generado.venceAt,
          etiqueta: _generado.etiqueta,
          puertas: _generado.puertas,
          respaldo: true,
        ),
      );
      final textos = textosEn(tester);

      expect(repositorio.generaciones, isEmpty);
      expect(find.text(textos.qrRapidoRespaldoAviso), findsOneWidget);
    });

    testWidgets('un límite de generación se explica con su texto', (
      tester,
    ) async {
      await _montar(
        tester,
        errorGenerar: const ErrorApi(code: 'qr.limite_diario', status: 429),
      );
      final textos = textosEn(tester);

      expect(find.byType(VisorQr), findsNothing);
      expect(find.text(textos.comunErrorQrLimiteDiario), findsOneWidget);
    });
  });

  group('seguimiento del QR', () {
    final intento = IntentoQr(
      ocurridoAt: _ahora,
      permitido: true,
      motivoCode: 'acceso.permitido',
      puertaNombre: 'Portón principal',
    );

    Future<void> esperarSondeo(WidgetTester tester) async {
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      await tester.pump();
    }

    testWidgets('si la puerta lo aceptó, reemplaza el QR por la confirmación', (
      tester,
    ) async {
      final repositorio = await _montar(tester);
      repositorio.seguimiento = SeguimientoQr(
        estado: EstadoQr.usado,
        ultimoIntento: intento,
      );
      await esperarSondeo(tester);

      expect(find.byType(VisorQr), findsNothing);
      expect(find.text('Acceso concedido'), findsOneWidget);
    });

    testWidgets('si lo rechazó, sigue el QR y explica el motivo', (
      tester,
    ) async {
      final repositorio = await _montar(tester);
      repositorio.seguimiento = SeguimientoQr(
        estado: EstadoQr.vigente,
        ultimoIntento: IntentoQr(
          ocurridoAt: _ahora,
          permitido: false,
          motivoCode: 'qr.otra_puerta',
          puertaNombre: 'Depósito',
        ),
      );
      await esperarSondeo(tester);

      expect(find.byType(VisorQr), findsOneWidget);
      expect(find.text('No se abrió Depósito'), findsOneWidget);
      expect(find.textContaining('no sirve para esa puerta'), findsOneWidget);
    });

    testWidgets('sin respuesta de la API el QR sigue y no hay avisos', (
      tester,
    ) async {
      await _montar(tester);
      await esperarSondeo(tester);

      expect(find.byType(VisorQr), findsOneWidget);
      expect(find.text('Acceso concedido'), findsNothing);
    });
  });
}
