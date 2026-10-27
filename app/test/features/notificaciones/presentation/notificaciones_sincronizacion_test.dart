import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/barra_navegacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/notificaciones_falsas.dart';
import '../../../helpers/pantalla.dart';
import '../../../helpers/sincronizacion_falsa.dart';

final _ahora = DateTime.utc(2026, 10, 27, 14);

const Set<String> _permisosDeBandeja = {
  Permisos.verNotificaciones,
  Permisos.gestionarNotificaciones,
};

/// La bandeja que cuenta cada pedido y puede dejarlo en curso o fallarlo.
class _NotificacionesConPedidos extends NotificacionesRepositorioFalso {
  new(this.pedidos);

  final PedidosFalsos pedidos;

  @override
  Future<Pagina<Notificacion>> listar({
    required int pagina,
    required int porPagina,
    required bool soloNoLeidas,
  }) async {
    await pedidos.atender();
    final respuesta = await super.listar(
      pagina: pagina,
      porPagina: porPagina,
      soloNoLeidas: soloNoLeidas,
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
    pagina: const NotificacionesPagina(),
    expandida: expandida,
    apaisada: apaisada,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: _permisosDeBandeja)),
      ),
      notificacionesRepositorioProvider.overrideWithValue(
        _NotificacionesConPedidos(pedidos),
      ),
      relojProvider.overrideWithValue(() => _ahora),
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
  testWidgets('en 852×393 la bandeja vacía no desborda y su título queda '
      'alcanzable sobre la barra inferior', (tester) async {
    await _montar(tester, apaisada: true);
    final textos = textosEn(tester);

    expect(tester.takeException(), isNull);
    final titulo = find.text(textos.notificacionesSinNotificaciones);
    await tester.ensureVisible(titulo);
    await tester.pump();

    expect(tester.takeException(), isNull);
    final barra = tester.getRect(find.byType(BarraNavegacion));
    expect(tester.getRect(titulo).bottom, lessThanOrEqualTo(barra.top));
  });

  testWidgets('en 852×393 "No leídas" vacía no desborda y su título queda '
      'alcanzable', (tester) async {
    await _montar(tester, apaisada: true);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.notificacionesFiltroNoLeidas));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    final titulo = find.text(textos.notificacionesSinNoLeidas);
    await tester.ensureVisible(titulo);
    await tester.pump();
    final barra = tester.getRect(find.byType(BarraNavegacion));
    expect(tester.getRect(titulo).bottom, lessThanOrEqualTo(barra.top));
  });

  testWidgets('tirar hacia abajo una bandeja vacía vuelve a pedirla', (
    tester,
  ) async {
    final pedidos = await _montar(tester, apaisada: true);
    expect(pedidos.llamadas, 1);

    await _tirarParaActualizar(tester);

    expect(pedidos.llamadas, 2);
  });

  testWidgets('tirar hacia abajo pide la bandeja, muestra "Actualizando…" '
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

  testWidgets('ninguna pantalla de la bandeja muestra un ícono de actualizar '
      '(en expandido)', (tester) async {
    await _montar(tester, expandida: true);

    expect(find.byIcon(Icons.refresh), findsNothing);
    expect(find.byIcon(Icons.sync), findsNothing);
  });

  testWidgets('ninguna pantalla de la bandeja muestra un ícono de actualizar '
      '(en compacto)', (tester) async {
    await _montar(tester);

    expect(find.byIcon(Icons.refresh), findsNothing);
    expect(find.byIcon(Icons.sync), findsNothing);
  });

  testWidgets('el refresco automático de 60 s pide la pestaña elegida', (
    tester,
  ) async {
    final pedidos = await _montar(tester);
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.notificacionesFiltroNoLeidas));
    await tester.pumpAndSettle();
    final antes = pedidos.llamadas;

    await tester.pump(const Duration(seconds: 60));

    expect(pedidos.llamadas, antes + 1);
  });

  testWidgets('un error del servidor no borra la bandeja que ya se ve', (
    tester,
  ) async {
    final pedidos = await _montar(tester, expandida: true);
    final textos = textosEn(tester);
    pedidos.error = const ErrorApi(code: 'error.servidor', status: 500);

    await _tirarParaActualizar(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(textos.notificacionesSinNotificaciones), findsOneWidget);
    expect(find.text(textos.comunSincronizacionSinConexion), findsNothing);
  });
}
