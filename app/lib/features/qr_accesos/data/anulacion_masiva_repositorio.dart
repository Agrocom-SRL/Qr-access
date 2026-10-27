import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/anulacion_masiva.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Anula en bloque los QR vigentes de mi rama. Los tests lo sustituyen por un
/// fake con el shape del contrato.
abstract interface class AnulacionMasivaRepositorio {
  /// El alcance es mi rama (quien pide): para el Administrador, su rama
  /// entera; para los demás, lo que les toca. La API decide, no la app.
  Future<ResultadoDeAnulacionMasiva> anularMiRama({required String motivo});
}

class AnulacionMasivaRepositorioApi implements AnulacionMasivaRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<ResultadoDeAnulacionMasiva> anularMiRama({
    required String motivo,
  }) async {
    final dto = await _api.anularQrDeMiRama(motivo: motivo);
    return ResultadoDeAnulacionMasiva(
      qrAnulados: dto.qrAnulados,
      usuariosAlcanzados: dto.usuariosAlcanzados,
    );
  }
}

final anulacionMasivaRepositorioProvider = Provider<AnulacionMasivaRepositorio>(
  (ref) => AnulacionMasivaRepositorioApi(ref.watch(clienteApiProvider)),
);
