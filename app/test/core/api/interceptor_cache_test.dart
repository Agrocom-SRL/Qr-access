import 'package:agrocom_acceso/core/api/interceptor_cache.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_cache_contrato.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/http.dart';

class _CacheEnMemoria implements AlmacenCache {
  final Map<String, EntradaCache> entradas = {};

  @override
  Future<EntradaCache?> leer(String clave) async => entradas[clave];

  @override
  Future<void> guardar(String clave, String cuerpo) async => entradas[clave] =
      EntradaCache(cuerpo: cuerpo, guardadoAt: DateTime.utc(2026, 10, 15, 14));

  @override
  Future<void> borrarTodo() async => entradas.clear();
}

void main() {
  late _CacheEnMemoria cache;
  late bool hayRed;
  late String? ambito;
  late List<DateTime> servidos;
  late int vivos;
  late Dio dio;

  setUp(() {
    cache = _CacheEnMemoria();
    hayRed = true;
    ambito = 'u1:r1';
    servidos = [];
    vivos = 0;
    dio = Dio(BaseOptions(baseUrl: 'http://api.test/api/v1'))
      ..httpClientAdapter = AdaptadorHttpFalso((options) async {
        if (!hayRed) {
          throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
          );
        }
        return respuestaJson(200, {'datos': options.path});
      })
      ..interceptors.add(
        InterceptorCache(
          cache,
          () => ambito,
          alServirGuardado: servidos.add,
          alRecibirDatosVivos: () => vivos++,
        ),
      );
  });

  test('sin conexión entrega la última lectura buena y avisa', () async {
    await dio.get<dynamic>('/puertas', queryParameters: {'pagina': 1});
    hayRed = false;
    final respuesta = await dio.get<dynamic>(
      '/puertas',
      queryParameters: {'pagina': 1},
    );
    expect(respuesta.data, {'datos': '/puertas'});
    expect(servidos, [DateTime.utc(2026, 10, 15, 14)]);
    expect(vivos, 1);
  });

  test('sin lectura guardada, el error de red sigue siendo error', () async {
    hayRed = false;
    expect(dio.get<dynamic>('/puertas'), throwsA(isA<DioException>()));
  });

  test(
    'otra consulta u otro rol no recibe lo guardado (aislamiento)',
    () async {
      await dio.get<dynamic>('/puertas', queryParameters: {'pagina': 1});
      hayRed = false;
      await expectLater(
        dio.get<dynamic>('/puertas', queryParameters: {'pagina': 2}),
        throwsA(isA<DioException>()),
      );
      ambito = 'u2:r9';
      await expectLater(
        dio.get<dynamic>('/puertas', queryParameters: {'pagina': 1}),
        throwsA(isA<DioException>()),
      );
    },
  );

  test('sin sesión no guarda ni sirve nada', () async {
    ambito = null;
    await dio.get<dynamic>('/puertas');
    expect(cache.entradas, isEmpty);
  });

  test('las escrituras no se guardan ni se sirven sin red', () async {
    await dio.post<dynamic>('/qr-accesos');
    expect(cache.entradas, isEmpty);
    hayRed = false;
    await expectLater(
      dio.post<dynamic>('/qr-accesos'),
      throwsA(isA<DioException>()),
    );
  });
}
