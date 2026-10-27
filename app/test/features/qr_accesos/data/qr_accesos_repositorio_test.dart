import 'dart:async';
import 'dart:math';

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

/// UUID v4 (RFC 4122), el formato de `Idempotency-Key` que genera la app.
final _formatoUuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

/// Falla de red: la petición no llegó a una respuesta (ADR 0031 §11).
DioException _sinRed(RequestOptions options) => DioException(
  requestOptions: options,
  type: DioExceptionType.connectionError,
);

/// Valores de `Idempotency-Key` de cada petición, en orden.
List<String?> _claves(AdaptadorHttpFalso adaptador) => [
  for (final p in adaptador.peticiones) p.headers['Idempotency-Key'] as String?,
];

void main() {
  late AlmacenQrEnMemoria almacen;

  /// Repositorio real sobre un adaptador HTTP de prueba: `responder` decide
  /// cada respuesta y las peticiones quedan en `adaptador.peticiones`.
  ///
  /// Los reintentos no esperan (`esperasReintento` a cero) y el azar tiene
  /// semilla, así que las claves de idempotencia son predecibles en el test.
  (QrAccesosRepositorioApi, AdaptadorHttpFalso) montar(
    Future<ResponseBody> Function(RequestOptions options) responder, {
    String? Function()? ambito,
  }) {
    final adaptador = AdaptadorHttpFalso(responder);
    final dio = Dio(BaseOptions(baseUrl: 'http://api.test/api/v1'))
      ..httpClientAdapter = adaptador;
    return (
      QrAccesosRepositorioApi(
        ClienteApi(dio),
        almacen,
        ambito: ambito,
        azar: Random(7),
        esperasReintento: const [Duration.zero, Duration.zero],
      ),
      adaptador,
    );
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

  group('idempotencia de la generación (ADR 0031 §11)', () {
    test(
      'un reintento tras sin red manda la misma clave y el mismo cuerpo',
      () async {
        var llamadas = 0;
        final (repositorio, adaptador) = montar((options) async {
          llamadas++;
          if (llamadas == 1) throw _sinRed(options);
          return respuestaJson(201, _generado());
        });

        final qr = await repositorio.generar(_datosPropio(), ahora: _ahora);

        expect(qr.texto, 'AQ1.nuevo');
        expect(adaptador.peticiones, hasLength(2));
        final claves = _claves(adaptador);
        expect(claves.first, matches(_formatoUuidV4));
        expect(claves.last, claves.first);
        expect(
          _cuerpo(adaptador.peticiones.last),
          _cuerpo(adaptador.peticiones.first),
        );
      },
    );

    test('un 5xx se reintenta con la misma clave', () async {
      var llamadas = 0;
      final (repositorio, adaptador) = montar((_) async {
        llamadas++;
        return llamadas == 1
            ? respuestaJson(503, {
                'type': 'about:blank',
                'title': 'Servicio no disponible',
                'status': 503,
                'code': 'servidor.no_disponible',
              })
            : respuestaJson(201, _generado());
      });

      await repositorio.generar(_datosPropio(), ahora: _ahora);

      expect(adaptador.peticiones, hasLength(2));
      expect(_claves(adaptador).toSet(), hasLength(1));
    });

    test('un toque posterior reutiliza la clave y el vencimiento', () async {
      var llamadas = 0;
      final (repositorio, adaptador) = montar((options) async {
        llamadas++;
        // Agota la generación y sus dos reintentos; la cuarta llega bien.
        if (llamadas <= 3) throw _sinRed(options);
        return respuestaJson(201, _generado());
      });
      DatosGeneracion datosA(DateTime ahora) => DatosGeneracion(
        puertaIds: const {'p1', 'p2'},
        vigencia: const Vigencia(OpcionVigencia.dosHoras),
        etiqueta: 'Entrada personal',
        ahora: ahora,
        propio: true,
      );

      await expectLater(
        repositorio.generar(datosA(_ahora), ahora: _ahora),
        throwsA(
          isA<ErrorApi>().having((e) => e.esSinConexion, 'sin red', isTrue),
        ),
      );
      final masTarde = _ahora.add(const Duration(minutes: 5));
      await repositorio.generar(datosA(masTarde), ahora: masTarde);

      expect(adaptador.peticiones, hasLength(4));
      expect(_claves(adaptador).toSet(), hasLength(1));
      expect(
        {for (final p in adaptador.peticiones) _cuerpo(p)['vence_at']},
        {_ahora.add(const Duration(hours: 2)).toIso8601String()},
      );
    });

    test(
      'una acción nueva tras una respuesta definitiva usa otra clave',
      () async {
        final (repositorio, adaptador) = montar(
          (_) async => respuestaJson(201, _generado()),
        );

        await repositorio.generar(_datosPropio(), ahora: _ahora);
        await repositorio.generar(_datosPropio(), ahora: _ahora);

        final claves = _claves(adaptador);
        expect(claves, hasLength(2));
        expect(claves.last, isNot(claves.first));
      },
    );

    test(
      'cambiar las puertas tras una falla transitoria empieza otra clave',
      () async {
        var llamadas = 0;
        final (repositorio, adaptador) = montar((options) async {
          llamadas++;
          if (llamadas <= 3) throw _sinRed(options);
          return respuestaJson(201, _generado());
        });
        await expectLater(
          repositorio.generar(_datosPropio(), ahora: _ahora),
          throwsA(isA<ErrorApi>()),
        );

        final otras = DatosGeneracion(
          puertaIds: const {'p1'},
          vigencia: Vigencia.porDefecto,
          etiqueta: 'Entrada personal',
          ahora: _ahora,
          propio: true,
        );
        await repositorio.generar(otras, ahora: _ahora);

        final claves = _claves(adaptador);
        expect(claves.last, isNot(claves.first));
      },
    );

    test('un doble toque en vuelo no genera un segundo QR', () async {
      final respuesta = Completer<ResponseBody>();
      final (repositorio, adaptador) = montar((_) => respuesta.future);

      final primero = repositorio.generar(_datosPropio(), ahora: _ahora);
      final segundo = repositorio.generar(_datosPropio(), ahora: _ahora);
      respuesta.complete(respuestaJson(201, _generado()));
      final qrs = await Future.wait([primero, segundo]);

      expect(adaptador.peticiones, hasLength(1));
      expect(qrs.map((qr) => qr.id), everyElement('qr1'));
      expect(qrs.map((qr) => qr.texto), everyElement('AQ1.nuevo'));
    });

    test(
      'un 409 idempotencia.conflicto llega con su código; luego, otra clave',
      () async {
        var llamadas = 0;
        final (repositorio, adaptador) = montar((_) async {
          llamadas++;
          return llamadas == 1
              ? respuestaJson(422, {
                  'type': 'about:blank',
                  'title': 'Conflicto',
                  'status': 422,
                  'code': 'idempotencia.conflicto',
                })
              : respuestaJson(201, _generado());
        });

        await expectLater(
          repositorio.generar(_datosPropio(), ahora: _ahora),
          throwsA(
            isA<ErrorApi>().having(
              (e) => e.code,
              'code',
              'idempotencia.conflicto',
            ),
          ),
        );
        await repositorio.generar(_datosPropio(), ahora: _ahora);

        final claves = _claves(adaptador);
        expect(claves, hasLength(2));
        expect(claves.last, isNot(claves.first));
      },
    );

    test(
      'un 409 idempotencia.en_curso se reintenta con la misma clave',
      () async {
        var llamadas = 0;
        final (repositorio, adaptador) = montar((_) async {
          llamadas++;
          return llamadas == 1
              ? respuestaJson(409, {
                  'type': 'about:blank',
                  'title': 'En curso',
                  'status': 409,
                  'code': 'idempotencia.en_curso',
                })
              : respuestaJson(201, _generado());
        });

        final qr = await repositorio.generar(_datosPropio(), ahora: _ahora);

        expect(qr.texto, 'AQ1.nuevo');
        expect(adaptador.peticiones, hasLength(2));
        expect(_claves(adaptador).toSet(), hasLength(1));
      },
    );

    test(
      'el reemplazo lleva su propia clave y la conserva al reintentar',
      () async {
        var llamadas = 0;
        final (repositorio, adaptador) = montar((options) async {
          llamadas++;
          // 1: sin token. 2: sin red al pedir el reemplazo.
          // 3: la generación se repite con su clave.
          // 4: el reemplazo llega con su clave.
          if (llamadas == 2) throw _sinRed(options);
          if (llamadas == 4) return respuestaJson(201, _generado());
          return respuestaJson(200, _reutilizado());
        });

        final qr = await repositorio.generar(_datosPropio(), ahora: _ahora);

        expect(qr.texto, 'AQ1.nuevo');
        final claves = _claves(adaptador);
        expect(claves, hasLength(4));
        expect(claves[2], claves[0]);
        expect(claves[3], claves[1]);
        expect(claves[1], isNot(claves[0]));
      },
    );

    test('otra persona en la misma app no reutiliza la clave', () async {
      var llamadas = 0;
      var quien = 'u1';
      final (repositorio, adaptador) = montar((options) async {
        llamadas++;
        if (llamadas <= 3) throw _sinRed(options);
        return respuestaJson(201, _generado());
      }, ambito: () => quien);
      await expectLater(
        repositorio.generar(_datosPropio(), ahora: _ahora),
        throwsA(isA<ErrorApi>()),
      );

      quien = 'u2';
      await repositorio.generar(_datosPropio(), ahora: _ahora);

      final claves = _claves(adaptador);
      expect(claves.last, isNot(claves.first));
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
