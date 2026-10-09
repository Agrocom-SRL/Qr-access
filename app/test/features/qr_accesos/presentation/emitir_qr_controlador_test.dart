import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/emitir_qr_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);
final _venceAt = DateTime.utc(2026, 10, 9, 23, 59);

final _emitido = QrEmitido(
  id: 'qr1',
  texto: 'AQ1.token',
  venceAt: _venceAt,
  etiqueta: null,
  puertas: const [PuertaDeQr(id: 'p1', nombre: 'Portón')],
);

ProviderContainer _contenedor(QrAccesosRepositorioFalso repositorio) {
  final contenedor = ProviderContainer(
    overrides: [
      qrAccesosRepositorioProvider.overrideWithValue(repositorio),
      relojProvider.overrideWithValue(() => _ahora),
    ],
  );
  addTearDown(contenedor.dispose);
  return contenedor;
}

EmitirQrControlador _controlador(ProviderContainer contenedor) =>
    contenedor.read(emitirQrControladorProvider.notifier);

EmitirQrEstado _estado(ProviderContainer contenedor) =>
    contenedor.read(emitirQrControladorProvider);

void main() {
  test('sin puertas marca el error y no llama a la API', () async {
    final repositorio = QrAccesosRepositorioFalso(emitido: _emitido);
    final contenedor = _contenedor(repositorio);

    final qr = await _controlador(contenedor).emitir();

    expect(qr, isNull);
    expect(_estado(contenedor).errorDatos, ErrorDatosEmision.sinPuertas);
    expect(repositorio.emisiones, isEmpty);
  });

  test('el paso 1 no avanza sin puertas; con una, sí', () {
    final contenedor = _contenedor(QrAccesosRepositorioFalso());
    final controlador = _controlador(contenedor)..siguiente();
    expect(_estado(contenedor).paso, PasoEmision.puertas);
    expect(_estado(contenedor).errorDatos, ErrorDatosEmision.sinPuertas);

    controlador
      ..alternarPuerta('p1')
      ..siguiente();
    expect(_estado(contenedor).paso, PasoEmision.vigencia);
    expect(_estado(contenedor).errorDatos, isNull);

    controlador.siguiente();
    expect(_estado(contenedor).paso, PasoEmision.confirmar);
    controlador.atras();
    expect(_estado(contenedor).paso, PasoEmision.vigencia);
  });

  test('una etiqueta de más de 40 caracteres no se envía', () async {
    final repositorio = QrAccesosRepositorioFalso(emitido: _emitido);
    final contenedor = _contenedor(repositorio);
    final controlador = _controlador(contenedor)
      ..alternarPuerta('p1')
      ..cambiarEtiqueta('a' * 41);

    await controlador.emitir();

    expect(_estado(contenedor).errorDatos, ErrorDatosEmision.etiquetaLarga);
    expect(repositorio.emisiones, isEmpty);
  });

  test('con una hora de vigencia, manda el vencimiento en UTC', () async {
    final repositorio = QrAccesosRepositorioFalso(emitido: _emitido);
    final contenedor = _contenedor(repositorio);
    final controlador = _controlador(contenedor)
      ..alternarPuerta('p1')
      ..elegirVigencia(const Vigencia(OpcionVigencia.unaHora))
      ..cambiarEtiqueta(' Proveedor de gas ');

    final qr = await controlador.emitir();

    expect(qr?.id, 'qr1');
    expect(repositorio.emisiones.single.puertaIds, ['p1']);
    expect(repositorio.emisiones.single.etiqueta, 'Proveedor de gas');
    expect(
      repositorio.emisiones.single.vigencia.venceAtPara(_ahora),
      DateTime.utc(2026, 10, 9, 15, 30),
    );
    expect(repositorio.ahoras.single, _ahora);
  });

  test('alternar una puerta dos veces la quita', () {
    final contenedor = _contenedor(QrAccesosRepositorioFalso());
    _controlador(contenedor)
      ..alternarPuerta('p1')
      ..alternarPuerta('p2')
      ..alternarPuerta('p1');

    expect(_estado(contenedor).puertaIds, {'p2'});
  });

  test('"Todas" marca las puertas del sitio y, si ya estaban, las quita', () {
    final contenedor = _contenedor(QrAccesosRepositorioFalso());
    final controlador = _controlador(contenedor)
      ..alternarPuerta('p1')
      ..alternarTodas(['p1', 'p2']);
    expect(_estado(contenedor).puertaIds, {'p1', 'p2'});

    controlador.alternarTodas(['p1', 'p2']);
    expect(_estado(contenedor).puertaIds, isEmpty);
  });

  test('"Repetir último" prellena puertas y etiqueta', () {
    final contenedor = _contenedor(QrAccesosRepositorioFalso());
    _controlador(contenedor).prellenar(
      const PrellenadoEmision(puertaIds: {'p1', 'p2'}, etiqueta: 'Gas'),
    );
    expect(_estado(contenedor).puertaIds, {'p1', 'p2'});
    expect(_estado(contenedor).etiqueta, 'Gas');
  });

  test('un error de la API queda en el estado y no devuelve QR', () async {
    final repositorio = QrAccesosRepositorioFalso(
      errorEmitir: const ErrorApi(code: 'suscripcion.vencida', status: 403),
    );
    final contenedor = _contenedor(repositorio);
    final controlador = _controlador(contenedor)..alternarPuerta('p1');

    final qr = await controlador.emitir();

    expect(qr, isNull);
    expect(_estado(contenedor).errorApi?.code, 'suscripcion.vencida');
    expect(_estado(contenedor).enviando, isFalse);
  });

  test('corregir un dato borra el error mostrado', () async {
    final contenedor = _contenedor(QrAccesosRepositorioFalso());
    final controlador = _controlador(contenedor);
    await controlador.emitir();
    expect(_estado(contenedor).errorDatos, isNotNull);

    controlador.alternarPuerta('p1');

    expect(_estado(contenedor).errorDatos, isNull);
  });
}
