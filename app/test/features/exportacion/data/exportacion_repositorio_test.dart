import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/http.dart';

const _csv = 'id,etiqueta\n1,Ana\n2,Luis\n';

ResponseBody _csvDePagina({
  required String total,
  required String filas,
  required String hayMas,
  String truncado = 'false',
}) => ResponseBody.fromString(
  _csv,
  200,
  headers: {
    Headers.contentTypeHeader: ['text/csv; charset=utf-8'],
    'x-total-filas': [total],
    'x-pagina': ['1'],
    'x-por-pagina': ['1000'],
    'x-filas': [filas],
    'x-hay-mas': [hayMas],
    'x-truncado': [truncado],
  },
);

void main() {
  late AdaptadorHttpFalso adaptador;
  late ExportacionRepositorioApi repositorio;
  late Future<ResponseBody> Function(RequestOptions) responder;

  setUp(() {
    responder = (_) async =>
        _csvDePagina(total: '2', filas: '2', hayMas: 'false');
    adaptador = AdaptadorHttpFalso((options) => responder(options));
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
      ..httpClientAdapter = adaptador;
    repositorio = ExportacionRepositorioApi(ClienteApi(dio));
  });

  test(
    'lecturas manda los filtros de resultado y de días de Bolivia',
    () async {
      final dia = instanteDeDia(DateTime.utc(2026, 10, 27));
      await repositorio.pagina(
        recurso: RecursoExportable.lecturas,
        pagina: 2,
        filtros: FiltrosDeExportacion(
          resultado: ResultadoFiltro.rechazado,
          desde: dia,
          hasta: dia,
        ),
      );

      final peticion = adaptador.peticiones.single;
      expect(peticion.path, '/exportaciones/lecturas');
      expect(peticion.queryParameters['pagina'], 2);
      expect(peticion.queryParameters['por_pagina'], porPaginaDeExportacion);
      expect(peticion.queryParameters['resultado'], 'rechazado');
      expect(
        peticion.queryParameters['desde'],
        DateTime.utc(2026, 10, 27, 4).toIso8601String(),
      );
      expect(
        peticion.queryParameters['hasta'],
        DateTime.utc(2026, 10, 28, 4).toIso8601String(),
      );
    },
  );

  test('usuarios y puertas no mandan ningún filtro de lecturas', () async {
    final dia = instanteDeDia(DateTime.utc(2026, 10, 27));
    await repositorio.pagina(
      recurso: RecursoExportable.usuarios,
      pagina: 1,
      filtros: FiltrosDeExportacion(
        resultado: ResultadoFiltro.permitido,
        desde: dia,
        hasta: dia,
      ),
    );

    final consulta = adaptador.peticiones.single.queryParameters;
    expect(consulta.containsKey('resultado'), isFalse);
    expect(consulta.containsKey('desde'), isFalse);
    expect(consulta.containsKey('hasta'), isFalse);
  });

  test('la página trae su CSV y lo que dicen sus cabeceras', () async {
    responder = (_) async =>
        _csvDePagina(total: '2500', filas: '1000', hayMas: 'true');

    final pagina = await repositorio.pagina(
      recurso: RecursoExportable.usuarios,
      pagina: 1,
      filtros: const FiltrosDeExportacion(),
    );

    expect(String.fromCharCodes(pagina.csv), _csv);
    expect(pagina.resumen.total, 2500);
    expect(pagina.resumen.filas, 1000);
    expect(pagina.resumen.pagina, 1);
    expect(pagina.resumen.hayMas, isTrue);
    expect(pagina.resumen.truncado, isFalse);
  });

  test('un tope de filas llega como ErrorApi con su code', () async {
    responder = (_) async => ResponseBody.fromString(
      '{"code":"exportacion.tope_excedido","status":422}',
      422,
      headers: {
        Headers.contentTypeHeader: ['application/problem+json'],
      },
    );

    expect(
      () => repositorio.pagina(
        recurso: RecursoExportable.lecturas,
        pagina: 11,
        filtros: const FiltrosDeExportacion(),
      ),
      throwsA(
        isA<ErrorApi>()
            .having((e) => e.code, 'code', 'exportacion.tope_excedido')
            .having((e) => e.status, 'status', 422),
      ),
    );
  });
}
