import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/imagen_qr.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Nombre del archivo PNG que se comparte.
const nombreArchivoQr = 'qr-acceso.png';

/// Comparte la imagen del QR recién emitido (ADR 0008, D-18). El estado es si
/// hay un compartir en curso.
class MostrarQrControlador extends Notifier<bool> {
  @override
  bool build() => false;

  /// `zonaSilencioModulos` y `colores` vienen del tema: la imagen se ve igual
  /// que en pantalla. `texto` es el mensaje que acompaña al archivo.
  Future<void> compartir({
    required QrEmitido qr,
    required String texto,
    required AccesoTokens tokens,
  }) async {
    state = true;
    try {
      final bytes = await renderizarQrPng(
        texto: qr.texto,
        colorModulo: tokens.colores.qrModulo,
        colorFondo: tokens.colores.qrFondo,
        zonaSilencioModulos: tokens.tamano.qrZonaSilencioModulos,
      );
      await ref
          .read(compartirImagenProvider)
          .compartirPng(
            bytes: bytes,
            nombreArchivo: nombreArchivoQr,
            texto: texto,
          );
    } finally {
      state = false;
    }
  }
}

final NotifierProvider<MostrarQrControlador, bool>
mostrarQrControladorProvider =
    NotifierProvider.autoDispose<MostrarQrControlador, bool>(
      MostrarQrControlador.new,
    );
