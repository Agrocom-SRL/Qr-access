import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/nombre_de_dispositivo.dart';
import 'package:agrocom_acceso/core/sesion/origen_de_sesion.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
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
  ProveedorOrigenDeSesion origen, {
  AparatoDeSesion aparato = AparatoDeSesion.android,
}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
    ..httpClientAdapter = adaptador;
  final nombre = ProveedorNombreDeDispositivo(
    () => aparato,
    () => lookupAppLocalizations(const Locale('es')),
  );
  return SesionRepositorioApi(ClienteApi(dio), origen, nombre);
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
        'dispositivo': 'Android',
      });
    },
  );

  test('el ingreso manda el nombre automático del aparato', () async {
    final adaptador = AdaptadorHttpFalso(_respuestaDeIngreso);
    final origen = ProveedorOrigenDeSesion(
      AlmacenInstalacionFalso('instalacion-guardada-01'),
      'ios',
    );

    await _repositorio(
      adaptador,
      origen,
      aparato: AparatoDeSesion.ipad,
    ).iniciar(Pin.desde('AGR7K2Q')!);

    final cuerpo = adaptador.peticiones.single.data as Map<String, dynamic>;
    expect(cuerpo['dispositivo'], 'iPad');
  });

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
      expect(cuerpo['dispositivo'], 'Android');
      expect(inicio.acceso, 'acc');
      expect(inicio.rolActivoId, 'r1');
    },
  );
}
