import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/eventos/data/eventos_repositorio.dart';
import 'package:agrocom_acceso/features/eventos/domain/lectura.dart';
import 'package:agrocom_acceso/features/eventos/presentation/eventos_pagina.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/barra_navegacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pantalla.dart';
import '../../../helpers/sincronizacion_falsa.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14, 30);

/// Repositorio que cuenta y puede dejar en curso o fallar cada `listar`.
class _EventosConPedidos extends EventosRepositorioFalso {
  new(super.pagina, this.pedidos);

  final PedidosFalsos pedidos;

  @override
  Future<Pagina<Lectura>> listar({
    required FiltroEventos filtro,
    required int pagina,
    required int porPagina,
  }) async {
    await pedidos.atender();
    final respuesta = await super.listar(
      filtro: filtro,
      pagina: pagina,
      porPagina: porPagina,
    );
    return respuesta;
  }
}

Future<PedidosFalsos> _montar(
  WidgetTester tester, {
  bool expandida = false,
  bool apaisada = false,
}) async {
  final pedidos = PedidosFalsos();
  await montarPantalla(
    tester,
    pagina: const EventosPagina(),
    expandida: expandida,
    apaisada: apaisada,
    overrides: [
      eventosRepositorioProvider.overrideWithValue(
        _EventosConPedidos(
          const Pagina<Lectura>(datos: [], pagina: 1, porPagina: 20, total: 0),
          pedidos,
        ),
      ),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(const []),
      ),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.verEventos})),
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
  testWidgets('en 852×393 el vacío no desborda y su título queda alcanzable '
      'sobre la barra inferior', (tester) async {
    await _montar(tester, apaisada: true);
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    final titulo = find.text(textos.lecturasSinResultados);
    await tester.ensureVisible(titulo);
    await tester.pump();

    expect(tester.takeException(), isNull);
    final barra = tester.getRect(find.byType(BarraNavegacion));
    expect(tester.getRect(titulo).bottom, lessThanOrEqualTo(barra.top));
  });

  testWidgets('tirar hacia abajo una lista vacía vuelve a pedirla', (
    tester,
  ) async {
    final pedidos = await _montar(tester, apaisada: true);
    expect(pedidos.llamadas, 1);

    await _tirarParaActualizar(tester);

    expect(pedidos.llamadas, 2);
  });

  testWidgets('tirar hacia abajo pide la consulta, muestra "Actualizando…" '
      'mientras la pide y luego "Actualizado"', (tester) async {
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

  testWidgets('ninguna pantalla de Lecturas muestra un ícono de actualizar '
      '(en expandido)', (tester) async {
    await _montar(tester, expandida: true);

    expect(find.byIcon(Icons.refresh), findsNothing);
    expect(find.byIcon(Icons.sync), findsNothing);
  });

  testWidgets('ninguna pantalla de Lecturas muestra un ícono de actualizar '
      '(en compacto)', (tester) async {
    await _montar(tester);

    expect(find.byIcon(Icons.refresh), findsNothing);
    expect(find.byIcon(Icons.sync), findsNothing);
  });

  testWidgets('el refresco automático de 60 s no pide en segundo plano', (
    tester,
  ) async {
    final pedidos = await _montar(tester);

    await tester.pump(const Duration(seconds: 60));
    expect(pedidos.llamadas, 2);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    await tester.pump(const Duration(seconds: 180));
    expect(pedidos.llamadas, 2);
  });

  testWidgets('un error del servidor conserva la hora de la última respuesta', (
    tester,
  ) async {
    final pedidos = await _montar(tester, expandida: true);
    final textos = textosEn(tester);
    pedidos.error = const ErrorApi(code: 'error.servidor', status: 500);

    await _tirarParaActualizar(tester);

    expect(find.text(textos.comunSincronizacionMomento), findsOneWidget);
    expect(find.text(textos.comunSincronizacionSinConexion), findsNothing);
  });
}
