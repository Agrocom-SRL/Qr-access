import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/anulacion_masiva_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/anulacion_masiva.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Anula los QR de mi rama. El estado es si hay una anulación en curso, para
/// que no se mande dos veces. Los errores se devuelven, no se lanzan: quien
/// llama decide cómo mostrarlos.
class AnulacionMasivaControlador extends Notifier<bool> {
  @override
  bool build() => false;

  Future<({ResultadoDeAnulacionMasiva? resultado, ErrorApi? error})>
  anularMiRama(String motivo) async {
    state = true;
    try {
      final resultado = await ref
          .read(anulacionMasivaRepositorioProvider)
          .anularMiRama(motivo: motivo);
      // Los QR que quedan vigentes cambian: Mis QR se vuelve a leer.
      ref
        ..invalidate(listadoQrProvider)
        ..invalidate(resumenQrProvider);
      return (resultado: resultado, error: null);
    } on ErrorApi catch (error) {
      return (resultado: null, error: error);
    } finally {
      state = false;
    }
  }
}

final NotifierProvider<AnulacionMasivaControlador, bool>
anulacionMasivaProvider =
    NotifierProvider.autoDispose<AnulacionMasivaControlador, bool>(
      AnulacionMasivaControlador.new,
    );
