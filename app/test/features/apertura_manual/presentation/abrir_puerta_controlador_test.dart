import 'package:agrocom_acceso/core/api/error_api.dart';
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

const _Consulta _enCurso = (estado: EstadoOrden.entregada, desenlace: null);
const _Consulta _abierta = (
  estado: EstadoOrden.ejecutada,
  desenlace: DesenlaceDeApertura.abierta,
);
const _Consulta _fallida = (
  estado: EstadoOrden.fallida,
  desenlace: DesenlaceDeApertura.noAbrio,
);

/// Repositorio con el mismo shape que la API: responde lo que se le programa.
class _Repositorio implements AperturaManualRepositorio {
  new({this.errorAlAbrir, this.consultas = const []});

  final Exception? errorAlAbrir;
  final List<Object> consultas;
  final List<String> claves = [];
  var _consultadas = 0;

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
  Future<_Consulta> estado(String ordenId) async {
    final siguiente = consultas[_consultadas.clamp(0, consultas.length - 1)];
    _consultadas++;
    if (siguiente is Exception) throw siguiente;
    return siguiente as _Consulta;
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

ProviderContainer _contenedor(_Repositorio repositorio) {
  final contenedor = ProviderContainer(
    overrides: [
      aperturaManualRepositorioProvider.overrideWithValue(repositorio),
      // Sin esperas reales: la consulta corre casi al instante y el tiempo
      // máximo son unas pocas vueltas.
      intervaloDeConsultaDeOrdenProvider.overrideWithValue(
        const Duration(milliseconds: 1),
      ),
      maxEsperaDeOrdenProvider.overrideWithValue(
        const Duration(milliseconds: 5),
      ),
    ],
  );
  addTearDown(contenedor.dispose);
  // El controlador es autoDispose: se mantiene vivo mientras dura la prueba.
  contenedor.listen(abrirPuertaProvider, (_, _) {});
  return contenedor;
}

void main() {
  test(
    'la puerta se abre cuando la placa informa que ejecutó la orden',
    () async {
      final repositorio = _Repositorio(consultas: const [_enCurso, _abierta]);
      final contenedor = _contenedor(repositorio);

      await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

      final estado = contenedor.read(abrirPuertaProvider);
      expect(estado.fase, FaseDeApertura.abierta);
      expect(estado.puertaNombre, 'Portón principal');
    },
  );

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

  test(
    'si la orden nunca se resuelve se da por no abierta (vencida)',
    () async {
      final repositorio = _Repositorio(consultas: const [_enCurso]);
      final contenedor = _contenedor(repositorio);

      await contenedor.read(abrirPuertaProvider.notifier).abrir(_puerta);

      final estado = contenedor.read(abrirPuertaProvider);
      expect(estado.fase, FaseDeApertura.fallo);
      expect(estado.desenlace, DesenlaceDeApertura.vencida);
    },
  );

  test(
    'un segundo toque con una apertura en curso no crea otra orden',
    () async {
      final repositorio = _Repositorio(consultas: const [_enCurso, _abierta]);
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
