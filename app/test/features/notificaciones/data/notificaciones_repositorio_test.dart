import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';

Map<String, Object?> _aviso({
  required String id,
  required String tipo,
  Map<String, Object?> datos = const {},
  bool leida = false,
}) => {
  'id': id,
  'tipo': tipo,
  'severidad': 'aviso',
  'cuenta_id': 'c1',
  'cantidad': 2,
  'resuelta': false,
  'leida': leida,
  'datos': {
    'cuenta': {'id': 'c1', 'codigo': 'AGR', 'nombre': 'Demo'},
    'sitio': null,
    'placas': <Object>[],
    ...datos,
  },
  'novedad_at': '2026-10-27T12:00:00.000Z',
  'resuelta_at': null,
  'leida_at': leida ? '2026-10-27T13:00:00.000Z' : null,
  'creada_at': '2026-10-27T11:59:00.000Z',
};

Future<ResponseBody> _respuesta(RequestOptions options) async {
  if (options.path.endsWith('/contador')) {
    return respuestaJson(200, {'no_leidas': 4});
  }
  if (options.path.endsWith('/leer-todas')) {
    return respuestaJson(200, {'marcadas': 3});
  }
  if (options.path.endsWith('/leer')) {
    return ResponseBody.fromString('', 204);
  }
  return respuestaJson(200, {
    'datos': [
      _aviso(
        id: '10',
        tipo: 'placa.caida_sostenida',
        datos: {
          'placas': [
            {
              'dispositivo_id': 'd1',
              'puerta_id': 'p1',
              'puerta_nombre': 'Portón <b>norte</b>',
              'desde': null,
            },
          ],
          'sitio': {'id': 's1', 'nombre': 'Sede Central'},
        },
      ),
      _aviso(
        id: '11',
        tipo: 'senal.uso',
        leida: true,
        datos: {
          'senal': {
            'tipo': 'uso_imposible',
            'usuario_etiqueta': 'Jorge',
            'gravedad': 'alta',
            'incidente_id': null,
            'dia': '2026-10-27',
            'valor': 3,
            'umbral': 2,
          },
        },
      ),
    ],
    'meta': {'pagina': 1, 'por_pagina': 20, 'total': 2},
  });
}

void main() {
  late AdaptadorHttpFalso adaptador;
  late NotificacionesRepositorioApi repositorio;

  setUp(() {
    adaptador = AdaptadorHttpFalso(_respuesta);
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    repositorio = NotificacionesRepositorioApi(ClienteApi(dio));
  });

  test('listar pide solo las no leídas cuando se elige el filtro', () async {
    await repositorio.listar(pagina: 1, porPagina: 20, soloNoLeidas: true);

    final query = adaptador.peticiones.single.queryParameters;
    expect(query['estado'], 'no_leidas');
    expect(query['por_pagina'], 20);
  });

  test('listar sin el filtro pide todas', () async {
    await repositorio.listar(pagina: 1, porPagina: 20, soloNoLeidas: false);

    expect(adaptador.peticiones.single.queryParameters['estado'], 'todas');
  });

  test(
    'convierte cada aviso, con sus puertas, su sitio y su subtipo',
    () async {
      final pagina = await repositorio.listar(
        pagina: 1,
        porPagina: 20,
        soloNoLeidas: false,
      );

      final caida = pagina.datos.first;
      expect(caida.tipo, TipoNotificacion.placaCaidaSostenida);
      expect(caida.severidad, Severidad.aviso);
      // El nombre de la puerta llega tal cual: la pantalla lo pinta como texto.
      expect(caida.puertas, ['Portón <b>norte</b>']);
      expect(caida.sitio, 'Sede Central');
      expect(caida.leida, isFalse);

      final senal = pagina.datos.last;
      expect(senal.tipo, TipoNotificacion.senalUsoImposible);
      expect(senal.usuario, 'Jorge');
      expect(senal.leida, isTrue);
    },
  );

  test(
    'el contador y las marcas usan sus rutas y devuelven los números',
    () async {
      expect(await repositorio.contarNoLeidas(), 4);
      expect(await repositorio.marcarTodasLeidas(), 3);
      await repositorio.marcarLeida('10');

      final rutas = adaptador.peticiones.map((p) => '${p.method} ${p.path}');
      expect(rutas, [
        'GET /notificaciones/contador',
        'POST /notificaciones/leer-todas',
        'POST /notificaciones/10/leer',
      ]);
    },
  );
}
