import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/sesion/data/sesion_repositorio.dart';
import 'package:agrocom_acceso/features/sesion/presentation/ingreso_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const _inicio = RespuestaInicio(
  acceso: 'acc',
  refresco: 'ref',
  usuario: UsuarioSesion(id: 'u1', etiqueta: 'Ana'),
  cuenta: CuentaSesion(id: 'c1', codigo: 'AGR', nombre: 'Demo'),
  roles: [RolSesion(id: 'r1', nombre: 'Usuario')],
  rolActivoId: 'r1',
);

ProviderContainer _contenedor({
  required SesionRepositorioFalso repositorio,
  required SesionFalsa sesion,
}) {
  final contenedor = ProviderContainer(
    overrides: [
      sesionRepositorioProvider.overrideWithValue(repositorio),
      sesionControladorProvider.overrideWith(() => sesion),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  addTearDown(contenedor.dispose);
  return contenedor;
}

void main() {
  test('un PIN con formato inválido no sale del dispositivo', () async {
    final repositorio = SesionRepositorioFalso(respuesta: _inicio);
    final contenedor = _contenedor(
      repositorio: repositorio,
      sesion: SesionFalsa(),
    );

    await contenedor
        .read(ingresoControladorProvider.notifier)
        .ingresar('AGR7K');

    expect(contenedor.read(ingresoControladorProvider).pinInvalido, isTrue);
    expect(repositorio.pinesRecibidos, isEmpty);
  });

  test('un PIN válido se envía normalizado y se adopta la respuesta', () async {
    final repositorio = SesionRepositorioFalso(respuesta: _inicio);
    final sesion = SesionFalsa();
    final contenedor = _contenedor(repositorio: repositorio, sesion: sesion);

    await contenedor
        .read(ingresoControladorProvider.notifier)
        .ingresar(' agr 7k2q ');

    expect(repositorio.pinesRecibidos.single.valor, 'AGR7K2Q');
    expect(sesion.inicios.single, _inicio);
    expect(contenedor.read(ingresoControladorProvider).enviando, isFalse);
  });

  test('un rechazo de la API queda en el estado, sin lanzarlo', () async {
    final repositorio = SesionRepositorioFalso(
      error: const ErrorApi(code: 'sesion.credenciales_invalidas', status: 401),
    );
    final contenedor = _contenedor(
      repositorio: repositorio,
      sesion: SesionFalsa(),
    );

    await contenedor
        .read(ingresoControladorProvider.notifier)
        .ingresar('AGR7K2Q');

    final estado = contenedor.read(ingresoControladorProvider);
    expect(estado.errorApi?.code, 'sesion.credenciales_invalidas');
    expect(estado.enviando, isFalse);
  });

  test('un fallo al adoptar la sesión también llega a la pantalla', () async {
    final sesion = SesionFalsa()
      ..errorAlAdoptar = const ErrorApi(code: ErrorApi.sinConexion);
    final contenedor = _contenedor(
      repositorio: SesionRepositorioFalso(respuesta: _inicio),
      sesion: sesion,
    );

    await contenedor
        .read(ingresoControladorProvider.notifier)
        .ingresar('AGR7K2Q');

    expect(
      contenedor.read(ingresoControladorProvider).errorApi?.esSinConexion,
      isTrue,
    );
  });

  test(
    'un bloqueo guarda hasta cuándo esperar, con lo que diga la API',
    () async {
      final contenedor = _contenedor(
        repositorio: SesionRepositorioFalso(
          error: const ErrorApi(
            code: 'sesion.bloqueada',
            status: 429,
            detalles: {'reintentar_en_segundos': 120},
          ),
        ),
        sesion: SesionFalsa(),
      );

      await contenedor
          .read(ingresoControladorProvider.notifier)
          .ingresar('AGR7K2Q');

      final estado = contenedor.read(ingresoControladorProvider);
      expect(estado.bloqueadoHasta, _ahora.add(const Duration(minutes: 2)));
      expect(estado.bloqueadoEn(_ahora), isTrue);
      expect(
        estado.bloqueadoEn(_ahora.add(const Duration(minutes: 3))),
        isFalse,
      );
      expect(estado.pinIncorrecto, isFalse);
    },
  );

  test(
    'sin el detalle de la API, el bloqueo dura el mínimo del servidor',
    () async {
      final contenedor = _contenedor(
        repositorio: SesionRepositorioFalso(
          error: const ErrorApi(code: 'sesion.bloqueada', status: 429),
        ),
        sesion: SesionFalsa(),
      );

      await contenedor
          .read(ingresoControladorProvider.notifier)
          .ingresar('AGR7K2Q');

      expect(
        contenedor.read(ingresoControladorProvider).bloqueadoHasta,
        _ahora.add(const Duration(seconds: segundosDeBloqueoPorDefecto)),
      );
    },
  );

  test('sin sesión autenticada el estado inicial no tiene errores', () {
    final contenedor = _contenedor(
      repositorio: SesionRepositorioFalso(respuesta: _inicio),
      sesion: SesionFalsa(),
    );
    final estado = contenedor.read(ingresoControladorProvider);
    expect(estado.pinInvalido, isFalse);
    expect(estado.errorApi, isNull);
  });
}
