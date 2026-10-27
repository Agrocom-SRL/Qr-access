import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/estadisticas_usuarios.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';
import '../../helpers/sincronizacion_falsa.dart';

final DateTime _t0 = DateTime.utc(2026, 10, 27, 14);

/// Reloj del test: se mueve con `ahora = ...` para simular que pasa el tiempo.
DateTime ahora = _t0;

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

EstadisticasDeUsuarios _datos({
  List<UsoDeUsuario> usuarios = const [_inactivo],
}) => EstadisticasDeUsuarios(
  ventanaDias: 30,
  umbralInactivoDias: 30,
  umbralRuidosoPorDia: 10,
  usuarios: usuarios,
  titulares: const [],
);

/// Repositorio que cuenta cada pedido de estadísticas y puede dejarlo en curso
/// o hacerlo fallar.
class _EstadisticasConPedidos extends UsuariosRepositorioFalso {
  new(this.pedidos, {required super.estadisticasActuales});

  final PedidosFalsos pedidos;

  @override
  Future<EstadisticasDeUsuarios> estadisticas() async {
    await pedidos.atender();
    return estadisticasActuales;
  }
}

Future<PedidosFalsos> _montar(
  WidgetTester tester, {
  EstadisticasDeUsuarios? estadisticas,
  bool apaisada = false,
  bool expandida = false,
}) async {
  ahora = _t0;
  final pedidos = PedidosFalsos();
  await montarPantalla(
    tester,
    pagina: const EstadisticasUsuariosPagina(),
    apaisada: apaisada,
    expandida: expandida,
    overrides: [
      usuariosRepositorioProvider.overrideWithValue(
        _EstadisticasConPedidos(
          pedidos,
          estadisticasActuales: estadisticas ?? _datos(),
        ),
      ),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(
          sesionCon(permisos: {Permisos.verUsuarios, Permisos.verEstadisticas}),
        ),
      ),
      relojProvider.overrideWithValue(() => ahora),
    ],
  );
  await tester.pump();
  await tester.pump();
  return pedidos;
}

/// Tira de la lista hacia abajo, como el gesto de actualizar en el teléfono.
Future<void> _tirarParaActualizar(WidgetTester tester) async {
  await tester.fling(
    find.byType(RefreshIndicator).first,
    const Offset(0, 300),
    1000,
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('tirar hacia abajo una lista con datos vuelve a pedirla', (
    tester,
  ) async {
    final pedidos = await _montar(tester);
    expect(pedidos.llamadas, 1);

    await _tirarParaActualizar(tester);

    expect(pedidos.llamadas, 2);
    expect(find.text('Marta Soliz'), findsOneWidget);
  });

  testWidgets('tirar hacia abajo una lista vacía también vuelve a pedirla', (
    tester,
  ) async {
    final pedidos = await _montar(tester, estadisticas: _datos(usuarios: []));
    final textos = textosEn(tester);
    expect(find.text(textos.estadisticasSinInactivos), findsOneWidget);

    await _tirarParaActualizar(tester);

    expect(pedidos.llamadas, 2);
  });

  testWidgets('no hay botón de actualizar en la cabecera', (tester) async {
    await _montar(tester, expandida: true);

    expect(find.byIcon(Icons.refresh), findsNothing);
  });

  testWidgets('la línea de sincronización dice cuándo fue la última '
      'actualización', (tester) async {
    await _montar(tester);

    expect(
      find.text(textosEn(tester).comunSincronizacionMomento),
      findsOneWidget,
    );
  });

  testWidgets('si un refresco falla, los datos se conservan y la línea dice '
      'sin conexión', (tester) async {
    final pedidos = await _montar(tester);
    final textos = textosEn(tester);

    pedidos.error = const ErrorApi(code: ErrorApi.sinConexion);
    await _tirarParaActualizar(tester);

    expect(find.text('Marta Soliz'), findsOneWidget);
    expect(find.text(textos.comunSincronizacionSinConexion), findsOneWidget);
    expect(find.text(textos.comunErrorSinConexion), findsNothing);
  });

  testWidgets('la línea pasa por actualizando mientras se pide', (
    tester,
  ) async {
    final pedidos = await _montar(tester);
    final textos = textosEn(tester);
    pedidos.pausa = Completer<void>();

    // El refresco automático es el que deja la petición en curso: la línea
    // lo muestra mientras no llega la respuesta (sin asentar la pantalla, que
    // esperaría a la pausa).
    await tester.pump(const Duration(seconds: 60));
    expect(pedidos.llamadas, 2);
    expect(find.text(textos.comunSincronizacionActualizando), findsOneWidget);

    pedidos.pausa!.complete();
    pedidos.pausa = null;
    await tester.pumpAndSettle();
    expect(find.text(textos.comunSincronizacionMomento), findsOneWidget);
  });

  testWidgets('el refresco automático cada 60 s vuelve a pedir', (
    tester,
  ) async {
    final pedidos = await _montar(tester);
    expect(pedidos.llamadas, 1);

    await tester.pump(const Duration(seconds: 60));

    expect(pedidos.llamadas, 2);
  });

  testWidgets('en 393×852 cabe la línea, la lista y no desborda', (
    tester,
  ) async {
    await _montar(tester);

    expect(tester.takeException(), isNull);
    expect(
      find.text(textosEn(tester).comunSincronizacionMomento),
      findsOneWidget,
    );
    expect(find.text('Marta Soliz'), findsOneWidget);
  });

  testWidgets('en 852×393 cabe la línea, la lista y no desborda', (
    tester,
  ) async {
    await _montar(tester, apaisada: true);

    expect(tester.takeException(), isNull);
    expect(
      find.text(textosEn(tester).comunSincronizacionMomento),
      findsOneWidget,
    );
    expect(find.text('Marta Soliz'), findsOneWidget);
  });
}
