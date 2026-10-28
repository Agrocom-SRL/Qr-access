import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/anulacion_masiva_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/anulacion_masiva_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/anulacion_falsa.dart';

ProviderContainer _contenedor(AnulacionMasivaRepositorioFalso repositorio) {
  final contenedor = ProviderContainer(
    overrides: [
      anulacionMasivaRepositorioProvider.overrideWithValue(repositorio),
    ],
  );
  addTearDown(contenedor.dispose);
  return contenedor;
}

void main() {
  test(
    'anular devuelve cuántos QR se anularon y deja de estar en curso',
    () async {
      final repositorio = AnulacionMasivaRepositorioFalso(qrAnulados: 5);
      final contenedor = _contenedor(repositorio);

      final envio = await contenedor
          .read(anulacionMasivaProvider.notifier)
          .anularMiRama('PIN filtrado');

      expect(envio.error, isNull);
      expect(envio.resultado?.qrAnulados, 5);
      expect(repositorio.motivos, ['PIN filtrado']);
      expect(contenedor.read(anulacionMasivaProvider), isFalse);
    },
  );

  test(
    'un error de la API se devuelve y no deja la anulación en curso',
    () async {
      final repositorio = AnulacionMasivaRepositorioFalso(
        error: const ErrorApi(code: 'permiso.denegado', status: 403),
      );
      final contenedor = _contenedor(repositorio);

      final envio = await contenedor
          .read(anulacionMasivaProvider.notifier)
          .anularMiRama('x');

      expect(envio.resultado, isNull);
      expect(envio.error?.code, 'permiso.denegado');
      expect(contenedor.read(anulacionMasivaProvider), isFalse);
    },
  );
}
