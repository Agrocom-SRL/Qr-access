import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/http.dart';

/// Proveedor de tokens de prueba. `renovar` espera a que el test libere la
/// renovación, así se simula que varias peticiones llegan con 401 a la vez.
class _TokensFalsos implements ProveedorTokens {
  new({required this.renovacionExitosa});

  final bool renovacionExitosa;
  final Completer<void> liberarRenovacion = Completer<void>();
  String? _acceso = 'viejo';
  int renovaciones = 0;

  @override
  String? get acceso => _acceso;

  @override
  Future<bool> renovar() async {
    renovaciones++;
    await liberarRenovacion.future;
    if (renovacionExitosa) _acceso = 'nuevo';
    return renovacionExitosa;
  }
}

/// La API responde 401 al acceso viejo y 200 al nuevo.
Future<ResponseBody> _api(RequestOptions options) async {
  if (options.headers['Authorization'] == 'Bearer nuevo') {
    return respuestaJson(200, {'ok': true});
  }
  return respuestaJson(401, {'code': 'sesion.expirada', 'status': 401});
}

/// Espera a que las peticiones lleguen a la espera de la renovación.
Future<void> _dejarLlegarPeticiones() =>
    Future<void>.delayed(const Duration(milliseconds: 50));

/// El error con el que termina una petición, o `null` si tuvo éxito.
Future<DioException?> _errorDe(Future<Response<void>> peticion) async {
  try {
    await peticion;
    return null;
  } on DioException catch (error) {
    return error;
  }
}

void main() {
  late _TokensFalsos tokens;
  late AdaptadorHttpFalso adaptador;
  late Dio dio;

  void armar({bool renovacionExitosa = true}) {
    tokens = _TokensFalsos(renovacionExitosa: renovacionExitosa);
    adaptador = AdaptadorHttpFalso(_api);
    dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    // El interceptor reintenta con el mismo `dio`, así que va el mismo.
    dio.interceptors.add(InterceptorSesion(tokens, dio));
  }

  test(
    'adjunta el acceso vigente como Bearer en la primera petición',
    () async {
      // Una API que acepta el acceso viejo: no hace falta renovar.
      armar();
      adaptador = AdaptadorHttpFalso((_) async => respuestaJson(200, {}));
      dio.httpClientAdapter = adaptador;

      await dio.get<void>('/algo');

      expect(
        adaptador.peticiones.single.headers['Authorization'],
        'Bearer viejo',
      );
      expect(tokens.renovaciones, 0);
    },
  );

  test('ante un 401 renueva una vez y repite la petición', () async {
    armar();
    tokens.liberarRenovacion.complete();

    final respuesta = await dio.get<Map<String, dynamic>>('/algo');

    expect(respuesta.statusCode, 200);
    expect(tokens.renovaciones, 1);
    expect(adaptador.peticiones.last.headers['Authorization'], 'Bearer nuevo');
  });

  test('varios 401 a la vez comparten una sola renovación', () async {
    armar();
    final peticiones = [
      _errorDe(dio.get<void>('/a')),
      _errorDe(dio.get<void>('/b')),
      _errorDe(dio.get<void>('/c')),
    ];
    await _dejarLlegarPeticiones();
    tokens.liberarRenovacion.complete();

    await Future.wait(peticiones);

    expect(tokens.renovaciones, 1);
  });

  test('si la sesión no se puede renovar, entrega el 401 original', () async {
    armar(renovacionExitosa: false);
    tokens.liberarRenovacion.complete();

    final error = await _errorDe(dio.get<void>('/algo'));

    expect(error, isNotNull);
    expect(ErrorApi.desde(error!).code, 'sesion.expirada');
    expect(tokens.renovaciones, 1);
  });

  test('una petición sin sesión (login) no renueva ante un 401', () async {
    armar();

    final error = await _errorDe(
      dio.post<void>(
        '/sesiones',
        options: Options(extra: {claveSinSesion: true}),
      ),
    );

    expect(error, isNotNull);
    expect(tokens.renovaciones, 0);
  });
}
