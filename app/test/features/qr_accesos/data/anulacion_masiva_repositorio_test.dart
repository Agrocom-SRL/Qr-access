import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/anulacion_masiva_repositorio.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';

void main() {
  late AdaptadorHttpFalso adaptador;
  late AnulacionMasivaRepositorioApi repositorio;
  late Future<ResponseBody> Function(RequestOptions) responder;

  setUp(() {
    responder = (_) async => respuestaJson(200, {
      'id': '9',
      'alcance': 'rama',
      'usuario_id': null,
      'usuarios_alcanzados': 4,
      'qr_anulados': 6,
    });
    adaptador = AdaptadorHttpFalso((options) => responder(options));
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    repositorio = AnulacionMasivaRepositorioApi(ClienteApi(dio));
  });

  test('anula con alcance de mi rama, sin usuario_id, y el motivo', () async {
    await repositorio.anularMiRama(motivo: 'PIN filtrado');

    final peticion = adaptador.peticiones.single;
    expect(peticion.method, 'POST');
    expect(peticion.path, '/qr-accesos/anulacion-masiva');
    expect(peticion.data, {'alcance': 'rama', 'motivo': 'PIN filtrado'});
  });

  test(
    'devuelve cuántos QR se anularon y a cuántos usuarios alcanzó',
    () async {
      final resultado = await repositorio.anularMiRama(motivo: 'PIN filtrado');

      expect(resultado.qrAnulados, 6);
      expect(resultado.usuariosAlcanzados, 4);
    },
  );

  test('un rechazo de la API llega como ErrorApi con su code', () async {
    responder = (_) async =>
        respuestaJson(403, {'code': 'permiso.denegado', 'status': 403});

    expect(
      () => repositorio.anularMiRama(motivo: 'x'),
      throwsA(
        isA<ErrorApi>().having((e) => e.code, 'code', 'permiso.denegado'),
      ),
    );
  });
}
