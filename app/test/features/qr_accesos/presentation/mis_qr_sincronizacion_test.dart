import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/barra_navegacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';
import '../../../helpers/sincronizacion_falsa.dart';

final DateTime _t0 = DateTime.utc(2026, 10, 27, 14);

/// El reloj del test: se mueve con `ahora = ...` para simular que pasa el
/// tiempo sin que el widget lo sepa hasta la siguiente actualización.
DateTime ahora = _t0;

QrAcceso _qr(String id) => QrAcceso(
  id: id,
  etiqueta: 'Proveedor de gas',
  estado: EstadoQr.vigente,
  venceAt: DateTime.utc(2026, 10, 27, 23, 59),
  usadoAt: null,
  anuladoAt: null,
  creadoAt: DateTime.utc(2026, 10, 27, 12),
  puertas: const [PuertaDeQr(id: 'p1', nombre: 'Portón principal')],
);

Pagina<QrAcceso> _pagina(List<QrAcceso> datos) =>
    Pagina(datos: datos, pagina: 1, porPagina: 20, total: datos.length);

/// Repositorio que cuenta y puede dejar en curso o fallar cada `listar`.
class _QrConPedidos extends QrAccesosRepositorioFalso {
  new(this.pedidos, {super.listado});

  final PedidosFalsos pedidos;

  @override
  Future<Pagina<QrAcceso>> listar({
    required EstadoQr estado,
    required int pagina,
    required int porPagina,
  }) async {
    await pedidos.atender();
    final respuesta = await super.listar(
      estado: estado,
      pagina: pagina,
      porPagina: porPagina,
    );
    return respuesta;
  }
}

const Set<String> _permisosDeQr = {Permisos.verQr, Permisos.generarQr};

Future<PedidosFalsos> _montar(
  WidgetTester tester, {
  Pagina<QrAcceso>? listado,
  bool expandida = false,
  bool apaisada = false,
  Set<String> permisos = _permisosDeQr,
}) async {
  ahora = _t0;
  final pedidos = PedidosFalsos();
  await montarPantalla(
    tester,
    pagina: const MisQrPagina(),
    expandida: expandida,
    apaisada: apaisada,
    overrides: [
      qrAccesosRepositorioProvider.overrideWithValue(
        _QrConPedidos(pedidos, listado: listado ?? _pagina(const [])),
      ),
      relojProvider.overrideWithValue(() => ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: permisos)),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
  return pedidos;
}

/// Tira de la lista hacia abajo y la suelta, como el gesto de actualizar.
Future<void> _tirarParaActualizar(WidgetTester tester) async {
  await tester.fling(find.byType(RefreshIndicator), const Offset(0, 300), 1000);
  await tester.pumpAndSettle();
}

/// Tira y suelta sin esperar a que termine: la petición queda en curso, así
/// que el indicador sigue girando y no se puede usar `pumpAndSettle`.
Future<void> _tirarSinEsperar(WidgetTester tester) async {
  await tester.fling(find.byType(RefreshIndicator), const Offset(0, 300), 1000);
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  testWidgets('tirar hacia abajo una lista vacía vuelve a pedirla', (
    tester,
  ) async {
    final pedidos = await _montar(tester);
    expect(pedidos.llamadas, 1);

    await _tirarParaActualizar(tester);

    expect(pedidos.llamadas, 2);
  });

  testWidgets('tirar hacia abajo una lista con datos vuelve a pedirla', (
    tester,
  ) async {
    final pedidos = await _montar(tester, listado: _pagina([_qr('1')]));
    expect(find.text('Proveedor de gas'), findsOneWidget);

    await _tirarParaActualizar(tester);

    expect(pedidos.llamadas, 2);
    expect(find.text('Proveedor de gas'), findsOneWidget);
  });

  testWidgets('tirar hacia abajo pide la lista y muestra "Actualizando…" '
      'mientras la pide', (tester) async {
    final pedidos = await _montar(tester);
    final textos = textosEn(tester);
    pedidos.pausa = Completer<void>();

    await _tirarSinEsperar(tester);

    expect(pedidos.llamadas, 2);
    expect(find.text(textos.comunSincronizacionActualizando), findsOneWidget);

    pedidos.pausa!.complete();
    pedidos.pausa = null;
    await tester.pumpAndSettle();

    expect(find.text(textos.comunSincronizacionActualizando), findsNothing);
    expect(find.text(textos.comunSincronizacionMomento), findsOneWidget);
  });

  testWidgets('la línea de sincronización pasa de actualizando a actualizado '
      'hace 2 min y a sin conexión', (tester) async {
    final pedidos = await _montar(tester);
    final textos = textosEn(tester);
    expect(find.text(textos.comunSincronizacionMomento), findsOneWidget);

    // El tiempo pasa y la respuesta falla con error del servidor: la lista se
    // conserva y la hora de la última respuesta viva no cambia.
    ahora = _t0.add(const Duration(minutes: 2));
    pedidos.error = const ErrorApi(code: 'error.servidor', status: 500);
    await _tirarParaActualizar(tester);
    expect(find.text(textos.comunSincronizacionMinutos(2)), findsOneWidget);

    pedidos.error = const ErrorApi(code: ErrorApi.sinConexion);
    await _tirarParaActualizar(tester);
    expect(find.text(textos.comunSincronizacionSinConexion), findsOneWidget);

    pedidos
      ..error = null
      ..pausa = Completer<void>();
    await _tirarSinEsperar(tester);
    expect(find.text(textos.comunSincronizacionActualizando), findsOneWidget);

    pedidos.pausa!.complete();
    pedidos.pausa = null;
    await tester.pumpAndSettle();
    expect(find.text(textos.comunSincronizacionMomento), findsOneWidget);
    expect(find.text(textos.comunSincronizacionSinConexion), findsNothing);
  });

  testWidgets('ninguna pantalla de Mis QR muestra un ícono de actualizar (en '
      'expandido)', (tester) async {
    await _montar(tester, expandida: true, listado: _pagina([_qr('1')]));

    expect(find.byIcon(Icons.refresh), findsNothing);
    expect(find.byIcon(Icons.sync), findsNothing);
  });

  testWidgets('ninguna pantalla de Mis QR muestra un ícono de actualizar (en '
      'compacto)', (tester) async {
    await _montar(tester, listado: _pagina([_qr('1')]));

    expect(find.byIcon(Icons.refresh), findsNothing);
    expect(find.byIcon(Icons.sync), findsNothing);
  });

  testWidgets('el refresco automático cada 60 s pide la lista y no duplica '
      'peticiones mientras una sigue en curso', (tester) async {
    final pedidos = await _montar(tester);
    expect(pedidos.llamadas, 1);

    pedidos.pausa = Completer<void>();
    await tester.pump(const Duration(seconds: 60));
    expect(pedidos.llamadas, 2);

    // Otro intervalo con la primera todavía en curso: no sale otra.
    await tester.pump(const Duration(seconds: 60));
    expect(pedidos.llamadas, 2);

    pedidos.pausa!.complete();
    pedidos.pausa = null;
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 60));
    expect(pedidos.llamadas, 3);
  });

  testWidgets('en segundo plano no pide; al volver a primer plano pide una '
      'vez', (tester) async {
    final pedidos = await _montar(tester);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    await tester.pump(const Duration(seconds: 180));
    expect(pedidos.llamadas, 1);

    // La app vuelve por "inactive" (la transición válida desde "hidden").
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(pedidos.llamadas, 2);
  });

  testWidgets('sin sesión no hace el refresco automático', (tester) async {
    final repositorio = QrAccesosRepositorioFalso();
    await montarPantalla(
      tester,
      pagina: const MisQrPagina(),
      overrides: [
        qrAccesosRepositorioProvider.overrideWithValue(repositorio),
        relojProvider.overrideWithValue(() => _t0),
        sesionControladorProvider.overrideWith(SesionFalsa.new),
      ],
    );
    await tester.pump();

    await tester.pump(const Duration(seconds: 180));

    // El repositorio falso anota cada listado: sin sesión, solo la primera
    // carga.
    expect(repositorio.estadosListados, hasLength(1));
  });

  testWidgets('en 852×393 el vacío no desborda y su título queda alcanzable '
      'sobre la barra inferior', (tester) async {
    await _montar(tester, apaisada: true);
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    final titulo = find.text(textos.qrVacioVigentesTitulo);
    await tester.ensureVisible(titulo);
    await tester.pump();

    expect(tester.takeException(), isNull);
    final barra = tester.getRect(find.byType(BarraNavegacion));
    expect(tester.getRect(titulo).bottom, lessThanOrEqualTo(barra.top));
  });

  testWidgets('en 393×852 el vacío se ve centrado y sin desbordes', (
    tester,
  ) async {
    await _montar(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(textosEn(tester).qrVacioVigentesTitulo), findsOneWidget);
  });

  testWidgets(
    'en 852×393, tirar hacia abajo el vacío vuelve a pedir la lista',
    (tester) async {
      final pedidos = await _montar(tester, apaisada: true);

      await _tirarParaActualizar(tester);

      expect(pedidos.llamadas, 2);
    },
  );
}
