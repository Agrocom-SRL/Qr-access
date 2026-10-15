import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/qr_rapido_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/visor_qr.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

final _emitido = QrEmitido(
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
  Exception? errorEmitir,
  QrEmitido? respaldo,
}) async {
  final repositorio = QrAccesosRepositorioFalso(
    emitido: _emitido,
    errorEmitir: errorEmitir,
    respaldo: respaldo,
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
        () => SesionFalsa(sesionCon(permisos: {Permisos.emitirQr})),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
  // El Lottie de emisión dura 1 s y el QR entra en 300 ms.
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(milliseconds: 16));
  await tester.pumpAndSettle();
  return repositorio;
}

void main() {
  testWidgets('emite sin formulario: todas las puertas y 2 horas', (
    tester,
  ) async {
    final repositorio = await _montar(tester);

    final emision = repositorio.emisiones.single;
    expect(emision.puertaIds, ['p1', 'p2']);
    expect(emision.vigencia.opcion, OpcionVigencia.finDelDia);
    expect(emision.etiqueta, isNotNull);
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

  testWidgets('sin puertas, lo dice y no emite', (tester) async {
    final repositorio = await _montar(tester, puertas: const []);
    final textos = textosEn(tester);

    expect(repositorio.emisiones, isEmpty);
    expect(find.text(textos.qrEmitirSinPuertas), findsOneWidget);
  });

  testWidgets('si la API falla, ofrece reintentar', (tester) async {
    final repositorio = await _montar(
      tester,
      errorEmitir: const ErrorApi(code: ErrorApi.sinConexion),
    );
    final textos = textosEn(tester);

    expect(find.byType(VisorQr), findsNothing);
    expect(find.text(textos.qrRapidoError), findsOneWidget);
    repositorio.errorEmitir = null;
    await tester.tap(find.text(textos.comunReintentar));
    await tester.pump();
    await tester.pump();
    expect(repositorio.emisiones, hasLength(2));
  });

  testWidgets('sin internet muestra el último QR propio guardado', (
    tester,
  ) async {
    await _montar(
      tester,
      errorEmitir: const ErrorApi(code: ErrorApi.sinConexion),
      respaldo: QrEmitido(
        id: 'qr0',
        texto: 'AQ1.respaldo',
        venceAt: _emitido.venceAt,
        etiqueta: 'Entrada para Ana',
        puertas: _emitido.puertas,
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
      errorEmitir: const ErrorApi(code: 'servidor.error'),
      respaldo: _emitido,
    );

    expect(find.byType(VisorQr), findsNothing);
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
