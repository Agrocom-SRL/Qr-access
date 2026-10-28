import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';

Map<String, Object?> _incidente({
  String id = '7',
  String estado = 'sin_resolver',
  Map<String, Object?>? resolucion,
  List<Map<String, Object?>> historial = const [],
}) => {
  'id': id,
  'usuario': {'id': 'u2', 'etiqueta': 'Jorge'},
  'tipo': 'uso_imposible',
  'gravedad': 'media',
  'origen': 'sistema',
  'registrado_por': null,
  'descripcion': null,
  'evidencia': {
    'qr_ids': ['1'],
    'evento_acceso_ids': ['2', '3'],
    'evento_limite_ids': <String>[],
  },
  'estado': estado,
  'resolucion': resolucion,
  'ocurrido_at': '2026-10-26T12:00:00.000Z',
  'created_at': '2026-10-26T12:01:00.000Z',
  'historial': historial,
};

final Map<String, Object> _resolucionConfirmada = {
  'resultado': 'confirmado',
  'motivo': 'Pasó dos veces',
  'resuelto_por': {'id': 'u1', 'etiqueta': 'Ana'},
  'resuelta_at': '2026-10-27T10:00:00.000Z',
};

void main() {
  late AdaptadorHttpFalso adaptador;
  late IncidentesRepositorioApi repositorio;
  late Future<ResponseBody> Function(RequestOptions) responder;

  setUp(() {
    responder = (_) async => respuestaJson(200, {});
    adaptador = AdaptadorHttpFalso((options) => responder(options));
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    repositorio = IncidentesRepositorioApi(ClienteApi(dio));
  });

  test('listar manda el tipo y el estado solo si se eligieron', () async {
    responder = (_) async => respuestaJson(200, {
      'datos': [_incidente()],
      'meta': {'pagina': 1, 'por_pagina': 20, 'total': 1},
    });

    await repositorio.listar(
      pagina: 1,
      porPagina: 20,
      tipo: TipoDeIncidente.usoImposible,
      estado: EstadoDeIncidente.sinResolver,
    );
    await repositorio.listar(pagina: 2, porPagina: 20);

    final primera = adaptador.peticiones.first.queryParameters;
    expect(primera['tipo'], 'uso_imposible');
    expect(primera['estado'], 'sin_resolver');
    final segunda = adaptador.peticiones.last.queryParameters;
    expect(segunda.containsKey('tipo'), isFalse);
    expect(segunda.containsKey('estado'), isFalse);
    expect(segunda['pagina'], 2);
  });

  test('convierte cada incidente y cuenta su evidencia sin ids', () async {
    responder = (_) async => respuestaJson(200, {
      'datos': [_incidente()],
      'meta': {'pagina': 1, 'por_pagina': 20, 'total': 1},
    });

    final pagina = await repositorio.listar(pagina: 1, porPagina: 20);

    final incidente = pagina.datos.single;
    expect(incidente.id, '7');
    expect(incidente.usuarioEtiqueta, 'Jorge');
    expect(incidente.tipo, TipoDeIncidente.usoImposible);
    expect(incidente.estado, EstadoDeIncidente.sinResolver);
    expect(incidente.evidencia.cuantosQr, 1);
    expect(incidente.evidencia.cuantosAccesos, 2);
    expect(incidente.evidencia.cuantosLimites, 0);
    expect(incidente.historial, isEmpty);
  });

  test('el detalle trae el historial de resoluciones', () async {
    responder = (_) async => respuestaJson(200, {
      ..._incidente(
        estado: 'confirmado',
        resolucion: _resolucionConfirmada,
        historial: [_resolucionConfirmada],
      ),
    });

    final incidente = await repositorio.ver('7');

    expect(incidente.estado, EstadoDeIncidente.confirmado);
    expect(incidente.resolucion?.motivo, 'Pasó dos veces');
    expect(incidente.resolucion?.resueltoPor, 'Ana');
    expect(
      incidente.historial.single.resultado,
      ResultadoDeResolucion.confirmado,
    );
  });

  test(
    'resolver manda el resultado y el motivo, y lee la reincidencia',
    () async {
      responder = (_) async => respuestaJson(200, {
        'incidente': _incidente(
          estado: 'confirmado',
          resolucion: _resolucionConfirmada,
          historial: [_resolucionConfirmada],
        ),
        'reincidencia': {
          'confirmados': 3,
          'minimo': 3,
          'ventana_dias': 30,
          'propuesta': 'restringir',
          'aplicada_automaticamente': false,
        },
      });

      final respuesta = await repositorio.resolver(
        '7',
        resultado: ResultadoDeResolucion.confirmado,
        motivo: 'Pasó dos veces',
      );

      final cuerpo = adaptador.peticiones.single.data;
      expect(adaptador.peticiones.single.path, '/incidentes/7/resolucion');
      expect(cuerpo, {'resultado': 'confirmado', 'motivo': 'Pasó dos veces'});
      final reincidencia = respuesta.reincidencia!;
      expect(reincidencia.confirmados, 3);
      expect(reincidencia.propuesta, AccionPropuesta.restringir);
      expect(reincidencia.aplicadaAutomaticamente, isFalse);
    },
  );

  test(
    'sin reincidencia (no confirmó), la respuesta no trae propuesta',
    () async {
      responder = (_) async => respuestaJson(200, {
        'incidente': _incidente(estado: 'descartado'),
        'reincidencia': null,
      });

      final respuesta = await repositorio.resolver(
        '7',
        resultado: ResultadoDeResolucion.descartado,
      );

      expect(respuesta.reincidencia, isNull);
      final cuerpo = adaptador.peticiones.single.data;
      expect(cuerpo, {'resultado': 'descartado'});
    },
  );

  test('un fallo de la API llega como ErrorApi con su code', () async {
    responder = (_) async =>
        respuestaJson(403, {'code': 'incidente.propio', 'status': 403});

    expect(
      () => repositorio.resolver(
        '7',
        resultado: ResultadoDeResolucion.confirmado,
        motivo: 'x',
      ),
      throwsA(
        isA<ErrorApi>().having((e) => e.code, 'code', 'incidente.propio'),
      ),
    );
  });

  test('la política de la cuenta se convierte a su dominio', () async {
    responder = (_) async => respuestaJson(200, {
      'reincidencia_minimo': 3,
      'reincidencia_ventana_dias': 30,
      'restriccion_automatica': true,
    });

    final politica = await repositorio.politica();

    expect(politica.minimo, 3);
    expect(politica.ventanaDias, 30);
    expect(politica.restriccionAutomatica, isTrue);
  });
}
