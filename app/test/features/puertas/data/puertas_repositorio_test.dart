import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/features/puertas/data/puertas_repositorio.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';

Map<String, Object?> _puerta(int n) => {
  'id': 'p$n',
  'nombre': 'Puerta $n',
  'sitio': {'id': 's1', 'nombre': 'Sede'},
};

/// Una API con 101 puertas: la primera página llena (100) y una segunda.
Future<ResponseBody> _api(RequestOptions options) async {
  final pagina = options.queryParameters['pagina'] as int;
  final porPagina = options.queryParameters['por_pagina'] as int;
  const total = 101;
  final desde = (pagina - 1) * porPagina + 1;
  final hasta = (desde + porPagina - 1).clamp(0, total);
  return respuestaJson(200, {
    'datos': [for (var n = desde; n <= hasta; n++) _puerta(n)],
    'meta': {'pagina': pagina, 'por_pagina': porPagina, 'total': total},
  });
}

void main() {
  test('listar todas recorre las páginas hasta el total', () async {
    final adaptador = AdaptadorHttpFalso(_api);
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    final repositorio = PuertasRepositorioApi(ClienteApi(dio));

    final puertas = await repositorio.listarTodas();

    expect(puertas, hasLength(101));
    expect(puertas.first.id, 'p1');
    expect(puertas.last.id, 'p101');
    expect(puertas.first.sitioNombre, 'Sede');
    expect(adaptador.peticiones, hasLength(2));
  });
}
