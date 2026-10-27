import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';

Map<String, Object?> _propuesta({bool aplicada = false}) => {
  'id': '21',
  'tipo': 'incidente.propuesta',
  'severidad': 'aviso',
  'cuenta_id': 'c1',
  'cantidad': 1,
  'resuelta': false,
  'leida': false,
  'datos': {
    'cuenta': {'id': 'c1', 'codigo': 'AGR', 'nombre': 'Demo'},
    'sitio': null,
    'placas': <Object>[],
    'propuesta': {
      'usuario_etiqueta': 'Jorge',
      'accion': 'restringir',
      'incidente_id': '7',
      'confirmados': 3,
      'minimo': 3,
      'ventana_dias': 30,
      'aplicada_automaticamente': aplicada,
    },
  },
  'novedad_at': '2026-10-27T12:00:00.000Z',
  'resuelta_at': null,
  'leida_at': null,
  'creada_at': '2026-10-27T11:59:00.000Z',
};

void main() {
  late AdaptadorHttpFalso adaptador;
  late NotificacionesRepositorioApi repositorio;
  late Map<String, Object?> aviso;

  setUp(() {
    aviso = _propuesta();
    adaptador = AdaptadorHttpFalso(
      (options) async => respuestaJson(200, {
        'datos': [aviso],
        'meta': {'pagina': 1, 'por_pagina': 20, 'total': 1},
      }),
    );
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    repositorio = NotificacionesRepositorioApi(ClienteApi(dio));
  });

  test(
    'un aviso de propuesta lleva su paso, su incidente y sus cifras',
    () async {
      final pagina = await repositorio.listar(
        pagina: 1,
        porPagina: 20,
        soloNoLeidas: false,
      );

      final propuesta = pagina.datos.single.propuesta!;
      expect(pagina.datos.single.tipo, TipoNotificacion.propuestaIncidente);
      expect(pagina.datos.single.usuario, 'Jorge');
      expect(propuesta.accion, 'restringir');
      expect(propuesta.incidenteId, '7');
      expect(propuesta.confirmados, 3);
      expect(propuesta.minimo, 3);
      expect(propuesta.ventanaDias, 30);
      expect(propuesta.aplicadaAutomaticamente, isFalse);
    },
  );

  test('un aviso que no es de propuesta no trae propuesta', () async {
    aviso = {
      ..._propuesta(),
      'tipo': 'placa.recuperada',
      'datos': {
        'cuenta': {'id': 'c1', 'codigo': 'AGR', 'nombre': 'Demo'},
        'sitio': null,
        'placas': <Object>[],
      },
    };

    final pagina = await repositorio.listar(
      pagina: 1,
      porPagina: 20,
      soloNoLeidas: false,
    );

    expect(pagina.datos.single.propuesta, isNull);
  });

  test('la reincidencia ya aplicada llega marcada', () async {
    aviso = _propuesta(aplicada: true);

    final pagina = await repositorio.listar(
      pagina: 1,
      porPagina: 20,
      soloNoLeidas: false,
    );

    expect(pagina.datos.single.propuesta!.aplicadaAutomaticamente, isTrue);
  });
}
