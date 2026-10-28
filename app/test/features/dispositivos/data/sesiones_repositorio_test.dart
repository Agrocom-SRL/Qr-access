import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/features/dispositivos/data/sesiones_repositorio.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';

Map<String, Object?> _sesion(String id, {bool actual = false}) => {
  'id': id,
  'plataforma': 'ios',
  'dispositivo': 'iPhone de Ana',
  'ip': '10.0.0.1',
  'iniciada_at': '2026-10-27T08:00:00.000Z',
  'ultima_actividad_at': '2026-10-27T12:30:00.000Z',
  'expira_at': '2026-11-03T08:00:00.000Z',
  'actual': actual,
};

Future<ResponseBody> _respuesta(RequestOptions options) async {
  if (options.method == 'DELETE' && options.path.endsWith('/otras')) {
    return respuestaJson(200, {'cerradas': 2});
  }
  if (options.method == 'DELETE') {
    return ResponseBody.fromString('', 204);
  }
  return respuestaJson(200, {
    'datos': [_sesion('s1', actual: true), _sesion('s2')],
    'meta': {'pagina': 1, 'por_pagina': 2, 'total': 2},
  });
}

void main() {
  late AdaptadorHttpFalso adaptador;
  late SesionesRepositorioApi repositorio;

  setUp(() {
    adaptador = AdaptadorHttpFalso(_respuesta);
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    repositorio = SesionesRepositorioApi(ClienteApi(dio));
  });

  test('listar convierte cada sesión y marca la actual', () async {
    final pagina = await repositorio.listar();

    expect(pagina.datos, hasLength(2));
    expect(pagina.datos.first.actual, isTrue);
    expect(pagina.datos.last.dispositivo, 'iPhone de Ana');
    expect(pagina.datos.last.plataforma, 'ios');
    expect(
      pagina.datos.last.ultimaActividadAt,
      DateTime.utc(2026, 10, 27, 12, 30),
    );
    expect(pagina.total, 2);
  });

  test('cerrar una sesión pide su id en la ruta', () async {
    await repositorio.cerrar('s2');

    final pedido = adaptador.peticiones.single;
    expect(pedido.method, 'DELETE');
    expect(pedido.path, endsWith('/sesiones/s2'));
  });

  test('cerrar las demás devuelve cuántas cerró', () async {
    final cerradas = await repositorio.cerrarOtras();

    expect(cerradas, 2);
    expect(adaptador.peticiones.single.path, endsWith('/sesiones/otras'));
  });
}
