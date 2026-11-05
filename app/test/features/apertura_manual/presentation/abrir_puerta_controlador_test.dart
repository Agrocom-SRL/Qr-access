import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/apertura_manual/data/apertura_manual_repositorio.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:agrocom_acceso/features/apertura_manual/presentation/abrir_puerta_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _puerta = PuertaAbrible(
  id: 'p1',
  nombre: 'Portón principal',
  sitioNombre: 'Condominio Norte',
  habilitada: true,
  disponible: true,
  tienePlaca: true,
  enLinea: true,
);

typedef _Consulta = ({EstadoOrden estado, DesenlaceDeApertura? desenlace});

const _Consulta _pendiente = (estado: EstadoOrden.pendiente, desenlace: null);
const _Consulta _tomada = (estado: EstadoOrden.entregada, desenlace: null);
const _Consulta _abierta = (
  estado: EstadoOrden.ejecutada,
  desenlace: DesenlaceDeApertura.abierta,
);
const _Consulta _ocupada = (
  estado: EstadoOrden.fallida,
  desenlace: DesenlaceDeApertura.ocupada,
);
const _Consulta _fallida = (
  estado: EstadoOrden.fallida,
  desenlace: DesenlaceDeApertura.noAbrio,
);

/// Repositorio con el mismo shape que la API: responde lo que se le programa.
/// Con [colgada], la consulta de estado nunca responde.
class _Repositorio implements AperturaManualRepositorio {
  new({this.errorAlAbrir, this.consultas = const [], this.colgada = false});

  final Exception? errorAlAbrir;
  final List<Object> consultas;
  final bool colgada;
  final List<String> claves = [];
  int llamadasAEstado = 0;

  @override
  Future<OrdenDeApertura> abrir(
    String puertaId, {
    required String claveIdempotencia,
  }) async {
    claves.add(claveIdempotencia);
    if (errorAlAbrir != null) throw errorAlAbrir!;
    return OrdenDeApertura(
      id: 'o1',
      estado: EstadoOrden.pendiente,
      venceAt: DateTime.utc(2026, 11, 10, 15),
    );
  }

  @override
  Future<_Consulta> estado(String ordenId) {
    if (colgada) return Completer<_Consulta>().future;
    final siguiente = consultas[llamadasAEstado.clamp(0, consultas.length - 1)];
    llamadasAEstado++;
    if (siguiente is Exception) return Future.error(siguiente);
    return Future.value(siguiente as _Consulta);
  }

  @override
  Future<List<PuertaAbrible>> puertas() async => const [_puerta];

  @override
  Future<void> configurarPuerta(String puertaId, {required bool habilitada}) =>
      throw UnimplementedError();

  @override
  Future<void> configurarCuenta({required bool habilitada}) =>
      throw UnimplementedError();
}

/// Tope de prueba: corto para que los casos de «no contactada» tarden poco.
const _maximoDePrueba = Duration(milliseconds: 200);

ProviderContainer _contenedor(_Repositorio repositorio) {
  final contenedor = ProviderContainer(
    overrides: [
      aperturaManualRepositorioProvider.overrideWithValue(repositorio),
      intervaloDeConsultaDeOrdenProvider.overrideWithValue(
        const Duration(milliseconds: 1),
      ),
      maxEsperaDeOrdenProvider.overrideWithValue(_maximoDePrueba),
    ],
  );
  addTearDown(contenedor.dispose);
  // El controlador es autoDispose: se mantiene vivo mientras dura la prueba.
  contenedor.listen(abrirPuertaProvider, (_, _) {});
  return contenedor;
}

void main() {
  test('el tope de la animación es de 5 s por omisión', () {
    expect(
      const Duraciones().esperaMaximaOrdenApertura,
      const Duration(seconds: 5),
    );
  });

  test(
    'la puerta se abre cuando la placa informa que ejecutó la orden',
    () async {
      final repositorio = _Repositorio(consultas: const [_abierta]);
      final contenedor = _contenedor(repositorio);

      await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

      final estado = contenedor.read(abrirPuertaProvider);
      expect(estado.fase, FaseDeApertura.abierta);
      expect(estado.puertaNombre, 'Portón principal');
    },
  );

  test('una orden tomada por la placa es «enviada», no «abierta», '
      'y la espera termina', () async {
    final repositorio = _Repositorio(consultas: const [_tomada, _abierta]);
    final contenedor = _contenedor(repositorio);

    await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

    final estado = contenedor.read(abrirPuertaProvider);
    expect(estado.fase, FaseDeApertura.enviada);
    expect(estado.puertaNombre, 'Portón principal');
    expect(estado.enCurso, isFalse);
    // Terminó al ver la orden tomada: no volvió a consultar.
    expect(repositorio.llamadasAEstado, 1);
  });

  test(
    'si la API rechaza la orden la puerta no se abrió y se ve el error',
    () async {
      const error = ErrorApi(code: 'puerta.sin_conexion', status: 409);
      final repositorio = _Repositorio(errorAlAbrir: error);
      final contenedor = _contenedor(repositorio);

      await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

      final estado = contenedor.read(abrirPuertaProvider);
      expect(estado.fase, FaseDeApertura.fallo);
      expect(estado.error, error);
      expect(estado.desenlace, isNull);
    },
  );

  test(
    'una orden que la placa descartó por ocupada llega como ocupada',
    () async {
      final repositorio = _Repositorio(consultas: const [_ocupada]);
      final contenedor = _contenedor(repositorio);

      await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

      final estado = contenedor.read(abrirPuertaProvider);
      expect(estado.fase, FaseDeApertura.fallo);
      expect(estado.desenlace, DesenlaceDeApertura.ocupada);
    },
  );

  test('una falla informada por la placa es "no se abrió"', () async {
    final repositorio = _Repositorio(consultas: const [_fallida]);
    final contenedor = _contenedor(repositorio);

    await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

    final estado = contenedor.read(abrirPuertaProvider);
    expect(estado.fase, FaseDeApertura.fallo);
    expect(estado.desenlace, DesenlaceDeApertura.noAbrio);
  });

  test(
    'una consulta que falla no cambia el desenlace: se vuelve a preguntar',
    () async {
      final repositorio = _Repositorio(
        consultas: [
          const ErrorApi(code: ErrorApi.sinConexion),
          _abierta,
        ],
      );
      final contenedor = _contenedor(repositorio);

      await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

      expect(contenedor.read(abrirPuertaProvider).fase, FaseDeApertura.abierta);
    },
  );

  test('si la placa nunca toma la orden, a los 5 s se da por no '
      'contactada (vencida)', () async {
    final repositorio = _Repositorio(consultas: const [_pendiente]);
    final contenedor = _contenedor(repositorio);

    await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

    final estado = contenedor.read(abrirPuertaProvider);
    expect(estado.fase, FaseDeApertura.fallo);
    expect(estado.desenlace, DesenlaceDeApertura.vencida);
    expect(estado.enCurso, isFalse);
  });

  test(
    'una consulta que se cuelga no alarga la animación: termina en el tope',
    () async {
      final repositorio = _Repositorio(colgada: true);
      final contenedor = _contenedor(repositorio);

      final inicio = DateTime.now();
      await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

      final estado = contenedor.read(abrirPuertaProvider);
      expect(estado.desenlace, DesenlaceDeApertura.vencida);
      expect(
        DateTime.now().difference(inicio),
        lessThan(const Duration(seconds: 5)),
      );
    },
  );

  test(
    'un segundo toque con una apertura en curso no crea otra orden',
    () async {
      final repositorio = _Repositorio(consultas: const [_tomada, _abierta]);
      final contenedor = _contenedor(repositorio);
      final controlador = contenedor.read(abrirPuertaProvider.notifier);

      final primera = controlador.abrir(_puerta);
      await controlador.abrir(_puerta);
      await primera;

      expect(repositorio.claves, hasLength(1));
    },
  );

  test('cada apertura lleva su propia clave de idempotencia', () async {
    final repositorio = _Repositorio(consultas: const [_abierta]);
    final contenedor = _contenedor(repositorio);
    final controlador = contenedor.read(abrirPuertaProvider.notifier);

    await controlador.abrir(_puerta);
    controlador.reiniciar();
    await controlador.abrir(_puerta);

    expect(repositorio.claves, hasLength(2));
    expect(repositorio.claves.toSet(), hasLength(2));
  });

  test(
    'reiniciar vuelve a la lista solo si no hay una apertura en curso',
    () async {
      final repositorio = _Repositorio(consultas: const [_abierta]);
      final contenedor = _contenedor(repositorio);
      final controlador = contenedor.read(abrirPuertaProvider.notifier);

      await controlador.abrir(_puerta);
      controlador.reiniciar();

      expect(contenedor.read(abrirPuertaProvider).fase, FaseDeApertura.libre);
    },
  );
}
