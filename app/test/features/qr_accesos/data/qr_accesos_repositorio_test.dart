import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_qr_contrato.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/http.dart';

final _ahora = DateTime.utc(2026, 10, 26, 14, 30);
final _venceAt = DateTime.utc(2026, 10, 26, 23, 59);

/// Respuesta de `POST /qr-accesos` con un token nuevo (201).
Map<String, Object?> _generado() => {
  'id': 'qr1',
  'texto': 'AQ1.nuevo',
  'reutilizado': false,
  'vence_at': _venceAt.toIso8601String(),
  'etiqueta': 'Entrada personal',
  'puertas': [
    {'id': 'p1', 'nombre': 'Portón'},
    {'id': 'p2', 'nombre': 'Depósito'},
  ],
};

/// Respuesta de `POST /qr-accesos` cuando ya hay un QR propio vigente (200):
/// no trae token porque la API no lo guarda (ADR 0030 §2.1).
Map<String, Object?> _reutilizado() => {
  ..._generado(),
  'texto': null,
  'reutilizado': true,
};

Map<String, Object?> _estado(String estado) => {
  'id': 'qr1',
  'estado': estado,
  'vence_at': _venceAt.toIso8601String(),
  'ultimo_intento': null,
};

DatosGeneracion _datosPropio() => DatosGeneracion(
  puertaIds: const {'p1', 'p2'},
  vigencia: Vigencia.porDefecto,
  etiqueta: 'Entrada personal',
  ahora: _ahora,
  propio: true,
);

QrPropioGuardado _propioLocal() => QrPropioGuardado(
  id: 'qr1',
  texto: 'AQ1.local',
  venceAt: _venceAt,
  etiqueta: 'Entrada personal',
  puertas: const [(id: 'p1', nombre: 'Portón'), (id: 'p2', nombre: 'Depósito')],
);

Map<String, dynamic> _cuerpo(RequestOptions options) =>
    options.data as Map<String, dynamic>;

void main() {
  late AlmacenQrEnMemoria almacen;

  /// Repositorio real sobre un adaptador HTTP de prueba: `responder` decide
  /// cada respuesta y las peticiones quedan en `adaptador.peticiones`.
  (QrAccesosRepositorioApi, AdaptadorHttpFalso) montar(
    Future<ResponseBody> Function(RequestOptions options) responder,
  ) {
    final adaptador = AdaptadorHttpFalso(responder);
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test/api/v1'))
      ..httpClientAdapter = adaptador;
    return (QrAccesosRepositorioApi(ClienteApi(dio), almacen), adaptador);
  }

  setUp(() => almacen = AlmacenQrEnMemoria());

  group('generar', () {
    test(
      'un QR nuevo se guarda en el dispositivo para reabrir Mi QR',
      () async {
        final (repositorio, _) = montar(
          (_) async => respuestaJson(201, _generado()),
        );

        final qr = await repositorio.generar(_datosPropio(), ahora: _ahora);

        expect(qr.texto, 'AQ1.nuevo');
        expect(almacen.ultimoPropio?.id, 'qr1');
        expect(almacen.ultimoPropio?.texto, 'AQ1.nuevo');
      },
    );

    test(
      'con reutilizado y sin token local, reintenta una vez con reemplazar',
      () async {
        final (repositorio, adaptador) = montar((options) async {
          final reemplazo = _cuerpo(options)['reemplazar'] == true;
          return reemplazo
              ? respuestaJson(201, _generado())
              : respuestaJson(200, _reutilizado());
        });

        final qr = await repositorio.generar(_datosPropio(), ahora: _ahora);

        expect(qr.texto, 'AQ1.nuevo');
        expect(adaptador.peticiones, hasLength(2));
        expect(
          _cuerpo(adaptador.peticiones.first),
          isNot(contains('reemplazar')),
        );
        expect(_cuerpo(adaptador.peticiones.last)['reemplazar'], isTrue);
        expect(_cuerpo(adaptador.peticiones.last)['propio'], isTrue);
      },
    );

    test('si el reintento sigue sin token, falla sin guardar nada', () async {
      final (repositorio, adaptador) = montar(
        (_) async => respuestaJson(200, _reutilizado()),
      );

      await expectLater(
        repositorio.generar(_datosPropio(), ahora: _ahora),
        throwsA(
          isA<ErrorApi>().having((e) => e.code, 'code', ErrorApi.desconocido),
        ),
      );
      expect(adaptador.peticiones, hasLength(2));
      expect(almacen.ultimoPropio, isNull);
    });

    test('un límite de la API llega con su código y su espera', () async {
      final (repositorio, _) = montar(
        (_) async => respuestaJson(429, {
          'type': 'about:blank',
          'title': 'Límite',
          'status': 429,
          'code': 'qr.limite_propios_sin_uso',
          'reintentar_en_segundos': 95,
        }),
      );

      await expectLater(
        repositorio.generar(_datosPropio(), ahora: _ahora),
        throwsA(
          isA<ErrorApi>()
              .having((e) => e.code, 'code', 'qr.limite_propios_sin_uso')
              .having((e) => e.reintentarEnSegundos, 'espera', 95),
        ),
      );
    });
  });

  group('reanudarPropio', () {
    test('con el QR guardado vigente lo devuelve sin generar nada', () async {
      await almacen.guardarUltimoPropio(_propioLocal());
      final (repositorio, adaptador) = montar(
        (_) async => respuestaJson(200, _estado('vigente')),
      );

      final qr = await repositorio.reanudarPropio(['p1', 'p2']);

      expect(qr?.texto, 'AQ1.local');
      expect(qr?.respaldo, isFalse);
      expect(adaptador.peticiones, hasLength(1));
      expect(adaptador.peticiones.single.method, 'GET');
      expect(
        adaptador.peticiones.single.path,
        endsWith('/qr-accesos/qr1/estado'),
      );
    });

    test('si el QR ya se usó, lo olvida y no devuelve nada', () async {
      await almacen.guardarUltimoPropio(_propioLocal());
      final (repositorio, _) = montar(
        (_) async => respuestaJson(200, _estado('usado')),
      );

      expect(await repositorio.reanudarPropio(['p1', 'p2']), isNull);
      expect(almacen.ultimoPropio, isNull);
    });

    test(
      'si la API ya no conoce el QR, lo olvida y no devuelve nada',
      () async {
        await almacen.guardarUltimoPropio(_propioLocal());
        final (repositorio, _) = montar(
          (_) async => respuestaJson(404, {
            'type': 'about:blank',
            'title': 'No encontrado',
            'status': 404,
            'code': 'qr.no_encontrado',
          }),
        );

        expect(await repositorio.reanudarPropio(['p1', 'p2']), isNull);
        expect(almacen.ultimoPropio, isNull);
      },
    );

    test('sin QR guardado no consulta nada', () async {
      final (repositorio, adaptador) = montar(
        (_) async => respuestaJson(200, _estado('vigente')),
      );

      expect(await repositorio.reanudarPropio(['p1', 'p2']), isNull);
      expect(adaptador.peticiones, isEmpty);
    });

    test('para otras puertas no reutiliza el guardado', () async {
      await almacen.guardarUltimoPropio(_propioLocal());
      final (repositorio, adaptador) = montar(
        (_) async => respuestaJson(200, _estado('vigente')),
      );

      expect(await repositorio.reanudarPropio(['p1']), isNull);
      expect(adaptador.peticiones, isEmpty);
      expect(almacen.ultimoPropio?.id, 'qr1');
    });

    test(
      'sin red se propaga como sin conexión y conserva el guardado',
      () async {
        await almacen.guardarUltimoPropio(_propioLocal());
        final (repositorio, _) = montar(
          (options) async => throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
          ),
        );

        await expectLater(
          repositorio.reanudarPropio(['p1', 'p2']),
          throwsA(
            isA<ErrorApi>().having((e) => e.esSinConexion, 'sin red', isTrue),
          ),
        );
        expect(almacen.ultimoPropio?.id, 'qr1');
      },
    );
  });
}
