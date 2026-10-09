import 'dart:convert';

import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_refresco.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/http.dart';

const Map<String, Object> _sesionActual = {
  'usuario': {'id': 'u1', 'etiqueta': 'Ana'},
  'cuenta': {'id': 'c1', 'codigo': 'AGR', 'nombre': 'Cuenta Demo'},
  'rol_activo': {'id': 'r1', 'nombre': 'Usuario'},
  'permisos': ['accesos.qr.emitir'],
};

/// Rutas de la API que el controlador usa, con las respuestas del contrato.
/// `refrescoValido` marca qué refresco acepta el servidor.
Future<ResponseBody> _api(
  RequestOptions options, {
  String refrescoValido = 'ref-1',
  bool red = false,
}) async {
  if (red) {
    throw DioException.connectionError(
      requestOptions: options,
      reason: 'sin red',
    );
  }
  final cuerpo = options.data is String
      ? jsonDecode(options.data as String) as Map<String, dynamic>
      : options.data as Map<String, dynamic>?;
  switch ((options.method, options.path)) {
    case ('POST', '/sesiones/refresco'):
      if (cuerpo?['refresco'] != refrescoValido) {
        return respuestaJson(401, {'code': 'sesion.refresco_invalido'});
      }
      return respuestaJson(200, {'acceso': 'acc-2', 'refresco': 'ref-2'});
    case ('GET', '/sesiones/actual'):
      return respuestaJson(200, _sesionActual);
    case ('POST', '/sesiones/rol-activo'):
      return respuestaJson(200, {'acceso': 'acc-3'});
    case ('DELETE', '/sesiones/actual'):
      return ResponseBody.fromString('', 204);
    default:
      return respuestaJson(404, {'code': 'recurso.no_encontrado'});
  }
}

/// Un contenedor con la API falsa y el almacén en memoria. El acceso del
/// contenedor no pasa por el interceptor: el controlador llama directo.
ProviderContainer _contenedor({
  required AlmacenRefrescoFalso almacen,
  String refrescoValido = 'ref-1',
  bool red = false,
}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
    ..httpClientAdapter = AdaptadorHttpFalso(
      (options) => _api(options, refrescoValido: refrescoValido, red: red),
    );
  return ProviderContainer(
    overrides: [
      clienteApiProvider.overrideWithValue(ClienteApi(dio)),
      almacenRefrescoProvider.overrideWithValue(almacen),
    ],
  );
}

/// Deja correr las microtareas pendientes (la restauración del arranque).
Future<void> _asentar() =>
    Future<void>.delayed(const Duration(milliseconds: 20));

void main() {
  late AlmacenRefrescoFalso almacen;

  setUp(() => almacen = AlmacenRefrescoFalso());

  group('adoptarInicio', () {
    test('sin rol activo, deja al usuario eligiendo rol', () async {
      final contenedor = _contenedor(almacen: almacen);
      addTearDown(contenedor.dispose);
      final controlador = contenedor.read(sesionControladorProvider.notifier);
      await _asentar();

      await controlador.adoptarInicio(
        const RespuestaInicio(
          acceso: 'acc-1',
          refresco: 'ref-1',
          usuario: UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
          cuenta: CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
          roles: [RolSesion(id: 'r1', nombre: 'Usuario')],
          rolActivoId: null,
        ),
      );

      expect(
        contenedor.read(sesionControladorProvider),
        isA<SesionEligiendoRol>(),
      );
      expect(almacen.refresco, 'ref-1');
    });

    test('con rol activo, carga permisos y entra', () async {
      final contenedor = _contenedor(almacen: almacen);
      addTearDown(contenedor.dispose);
      final controlador = contenedor.read(sesionControladorProvider.notifier);
      await _asentar();

      await controlador.adoptarInicio(
        const RespuestaInicio(
          acceso: 'acc-1',
          refresco: 'ref-1',
          usuario: UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
          cuenta: CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
          roles: [RolSesion(id: 'r1', nombre: 'Usuario')],
          rolActivoId: 'r1',
        ),
      );

      final estado = contenedor.read(sesionControladorProvider);
      expect(estado, isA<SesionAutenticada>());
      expect(estado.tiene(Permisos.emitirQr), isTrue);
      expect(estado.tiene(Permisos.anularQr), isFalse);
    });

    test('si no se puede leer la sesión, no deja tokens a medias', () async {
      final contenedor = _contenedor(almacen: almacen, red: true);
      addTearDown(contenedor.dispose);
      final controlador = contenedor.read(sesionControladorProvider.notifier);
      await _asentar();

      await expectLater(
        controlador.adoptarInicio(
          const RespuestaInicio(
            acceso: 'acc-1',
            refresco: 'ref-1',
            usuario: UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
            cuenta: CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
            roles: [],
            rolActivoId: 'r1',
          ),
        ),
        throwsA(isA<Object>()),
      );

      expect(contenedor.read(sesionControladorProvider), isA<SinSesion>());
      expect(almacen.refresco, isNull);
    });
  });

  group('renovar', () {
    test('con un refresco válido, rota el par de tokens', () async {
      final contenedor = _contenedor(almacen: almacen);
      addTearDown(contenedor.dispose);
      final controlador = contenedor.read(sesionControladorProvider.notifier);
      await _asentar();
      almacen.refresco = 'ref-1';

      final renovado = await controlador.renovar();

      expect(renovado, isTrue);
      expect(controlador.acceso, 'acc-2');
      expect(almacen.refresco, 'ref-2');
    });

    test(
      'con un refresco rechazado, cierra la sesión y borra el refresco',
      () async {
        final contenedor = _contenedor(almacen: almacen);
        addTearDown(contenedor.dispose);
        final controlador = contenedor.read(sesionControladorProvider.notifier);
        await _asentar();
        almacen.refresco = 'vencido';

        final renovado = await controlador.renovar();

        expect(renovado, isFalse);
        expect(contenedor.read(sesionControladorProvider), isA<SinSesion>());
        expect(almacen.refresco, isNull);
      },
    );

    test('sin red, conserva la sesión para reintentar más tarde', () async {
      final contenedor = _contenedor(almacen: almacen, red: true);
      addTearDown(contenedor.dispose);
      final controlador = contenedor.read(sesionControladorProvider.notifier);
      await _asentar();
      almacen.refresco = 'ref-1';

      final renovado = await controlador.renovar();

      expect(renovado, isFalse);
      expect(almacen.refresco, 'ref-1');
    });
  });

  group('restaurar al abrir la app', () {
    test('sin refresco guardado, pide ingresar (web: siempre)', () async {
      final contenedor = _contenedor(almacen: almacen);
      addTearDown(contenedor.dispose);
      contenedor.read(sesionControladorProvider.notifier);
      await _asentar();

      expect(contenedor.read(sesionControladorProvider), isA<SinSesion>());
    });

    test('con refresco guardado, vuelve a entrar con sus permisos', () async {
      almacen.refresco = 'ref-1';
      final contenedor = _contenedor(almacen: almacen);
      addTearDown(contenedor.dispose);
      contenedor.read(sesionControladorProvider.notifier);
      await _asentar();

      final estado = contenedor.read(sesionControladorProvider);
      expect(estado, isA<SesionAutenticada>());
      expect(estado.tiene(Permisos.emitirQr), isTrue);
    });
  });

  group('elegirRol y cerrar', () {
    test('elegir rol cambia el acceso y carga los permisos del rol', () async {
      final contenedor = _contenedor(almacen: almacen);
      addTearDown(contenedor.dispose);
      final controlador = contenedor.read(sesionControladorProvider.notifier);
      await _asentar();
      await controlador.adoptarInicio(
        const RespuestaInicio(
          acceso: 'acc-1',
          refresco: 'ref-1',
          usuario: UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
          cuenta: CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
          roles: [RolSesion(id: 'r1', nombre: 'Usuario')],
          rolActivoId: null,
        ),
      );

      await controlador.elegirRol('r1');

      expect(controlador.acceso, 'acc-3');
      expect(
        contenedor.read(sesionControladorProvider),
        isA<SesionAutenticada>(),
      );
    });

    test('cerrar olvida la sesión y el refresco del dispositivo', () async {
      final contenedor = _contenedor(almacen: almacen);
      addTearDown(contenedor.dispose);
      final controlador = contenedor.read(sesionControladorProvider.notifier);
      await _asentar();
      almacen.refresco = 'ref-1';

      await controlador.cerrar();

      expect(contenedor.read(sesionControladorProvider), isA<SinSesion>());
      expect(controlador.acceso, isNull);
      expect(almacen.refresco, isNull);
    });
  });
}
