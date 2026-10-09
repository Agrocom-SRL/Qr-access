import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';

ProviderContainer _contenedor(QrAccesosRepositorioFalso repositorio) {
  final contenedor = ProviderContainer(
    overrides: [qrAccesosRepositorioProvider.overrideWithValue(repositorio)],
  );
  addTearDown(contenedor.dispose);
  return contenedor;
}

void main() {
  test('el listado arranca con los QR vigentes, página 1', () async {
    final repositorio = QrAccesosRepositorioFalso();
    final contenedor = _contenedor(repositorio);

    await contenedor.read(listadoQrProvider.future);

    expect(repositorio.estadosListados, [EstadoQr.vigente]);
  });

  test('elegir otro estado vuelve a la página 1 y pide ese estado', () async {
    final repositorio = QrAccesosRepositorioFalso();
    final contenedor = _contenedor(repositorio);
    contenedor.read(filtroQrProvider.notifier)
      ..irAPagina(3)
      ..elegirEstado(EstadoQr.usado);

    final filtro = contenedor.read(filtroQrProvider);
    expect(filtro.pagina, 1);
    await contenedor.read(listadoQrProvider.future);
    expect(repositorio.estadosListados.last, EstadoQr.usado);
  });

  test('cambiar de página pide la página elegida', () async {
    final repositorio = QrAccesosRepositorioFalso();
    final contenedor = _contenedor(repositorio);
    await contenedor.read(listadoQrProvider.future);

    contenedor.read(filtroQrProvider.notifier).irAPagina(2);
    final listado = await contenedor.read(listadoQrProvider.future);

    expect(listado.pagina, 2);
  });

  test('anular un QR lo pide a la API y recarga el listado', () async {
    final repositorio = QrAccesosRepositorioFalso();
    final contenedor = _contenedor(repositorio);
    await contenedor.read(listadoQrProvider.future);
    final antes = repositorio.estadosListados.length;

    final error = await contenedor
        .read(anularQrControladorProvider.notifier)
        .anular('qr1');

    expect(error, isNull);
    expect(repositorio.anulados, ['qr1']);
    await contenedor.read(listadoQrProvider.future);
    expect(repositorio.estadosListados.length, greaterThan(antes));
  });

  test(
    'si la API rechaza la anulación, devuelve el error y no recarga',
    () async {
      final repositorio = QrAccesosRepositorioFalso(
        errorAnular: const ErrorApi(code: 'qr.ya_usado', status: 409),
      );
      final contenedor = _contenedor(repositorio);

      final error = await contenedor
          .read(anularQrControladorProvider.notifier)
          .anular('qr1');

      expect(error?.code, 'qr.ya_usado');
      expect(repositorio.anulados, isEmpty);
      expect(contenedor.read(anularQrControladorProvider), isFalse);
    },
  );

  test('una página vacía no rompe el listado', () async {
    final repositorio = QrAccesosRepositorioFalso(
      listado: const Pagina(datos: [], pagina: 1, porPagina: 20, total: 0),
    );
    final contenedor = _contenedor(repositorio);

    final listado = await contenedor.read(listadoQrProvider.future);

    expect(listado.datos, isEmpty);
  });
}
