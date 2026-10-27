import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/sesion/origen_de_sesion.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';
import '../../../helpers/instalacion_falsa.dart';

Future<ResponseBody> _respuestaDeIngreso(RequestOptions options) async =>
    respuestaJson(200, {
      'acceso': 'acc',
      'refresco': 'ref',
      'usuario': {'id': 'u1', 'etiqueta': 'Ana'},
      'cuenta': {'id': 'c1', 'codigo': 'AGR', 'nombre': 'Demo'},
      'roles': <Object>[],
      'rol_activo_id': 'r1',
    });

SesionRepositorioApi _repositorio(
  AdaptadorHttpFalso adaptador,
  ProveedorOrigenDeSesion origen,
) {
  final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
    ..httpClientAdapter = adaptador;
  return SesionRepositorioApi(ClienteApi(dio), origen);
}

void main() {
  test(
    'el ingreso envía la instalación y la plataforma junto al PIN',
    () async {
      final adaptador = AdaptadorHttpFalso(_respuestaDeIngreso);
      final origen = ProveedorOrigenDeSesion(
        AlmacenInstalacionFalso('instalacion-guardada-01'),
        'android',
      );

      await _repositorio(adaptador, origen).iniciar(Pin.desde('AGR7K2Q')!);

      final cuerpo = adaptador.peticiones.single.data as Map<String, dynamic>;
      expect(cuerpo, {
        'pin': 'AGR7K2Q',
        'instalacion_id': 'instalacion-guardada-01',
        'plataforma': 'android',
      });
    },
  );

  test(
    'sin plataforma declarada no manda el campo (la API lo acepta ausente)',
    () async {
      final adaptador = AdaptadorHttpFalso(_respuestaDeIngreso);
      final origen = ProveedorOrigenDeSesion(
        AlmacenInstalacionFalso('instalacion-guardada-01'),
        null,
      );

      final inicio = await _repositorio(
        adaptador,
        origen,
      ).iniciar(Pin.desde('AGR7K2Q')!);

      final cuerpo = adaptador.peticiones.single.data as Map<String, dynamic>;
      expect(cuerpo.containsKey('plataforma'), isFalse);
      expect(inicio.acceso, 'acc');
      expect(inicio.rolActivoId, 'r1');
    },
  );
}
