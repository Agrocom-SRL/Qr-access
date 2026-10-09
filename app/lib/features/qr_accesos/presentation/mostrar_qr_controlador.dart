import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/qr/imagen_qr.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Nombre del archivo PNG que se comparte.
const nombreArchivoQr = 'qr-acceso.png';

/// Estado de la pantalla del QR emitido: si se está compartiendo y si la
/// imagen ya salió (para no pedir confirmación al cerrar, S05).
@immutable
class MostrarQrEstado {
  const new({
    this.compartiendo = false,
    this.compartido = false,
    this.descargado = false,
    this.fallo = false,
  });

  final bool compartiendo;
  final bool compartido;

  /// En web sin Web Share API, la imagen se descargó en vez de compartirse.
  final bool descargado;
  final bool fallo;
}

/// Comparte la imagen del QR recién emitido (ADR 0008, D-18).
class MostrarQrControlador extends Notifier<MostrarQrEstado> {
  @override
  MostrarQrEstado build() => const MostrarQrEstado();

  /// `tokens` da colores y familia de letra para que la imagen se vea como la
  /// pantalla. `textos` son los de la imagen y `mensaje` acompaña al archivo.
  Future<void> compartir({
    required QrEmitido qr,
    required TextosDeImagenQr textos,
    required String mensaje,
    required AccesoTokens tokens,
  }) async {
    if (state.compartiendo) return;
    state = const MostrarQrEstado(compartiendo: true);
    try {
      final bytes = await renderizarQrPng(
        texto: qr.texto,
        textos: textos,
        colorModulo: tokens.colores.qrModulo,
        colorFondo: tokens.colores.qrFondo,
        colorTexto: tokens.colores.qrModulo,
        colorTextoSecundario: ColoresSemanticos.claro.textoSecundario,
        familiaDeLetra: tokens.tipografia.familia,
        zonaSilencioModulos: tokens.tamano.qrZonaSilencioModulos,
      );
      final resultado = await ref
          .read(compartirImagenProvider)
          .compartirPng(
            bytes: bytes,
            nombreArchivo: nombreArchivoQr,
            texto: mensaje,
          );
      state = MostrarQrEstado(
        compartido: resultado == ResultadoCompartir.compartido,
        descargado: resultado == ResultadoCompartir.descargado,
      );
    } on Exception {
      state = const MostrarQrEstado(fallo: true);
    }
  }
}

final NotifierProvider<MostrarQrControlador, MostrarQrEstado>
mostrarQrControladorProvider =
    NotifierProvider.autoDispose<MostrarQrControlador, MostrarQrEstado>(
      MostrarQrControlador.new,
    );
