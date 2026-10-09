import 'dart:typed_data';

import 'package:agrocom_acceso/core/plataforma/descargar_archivo.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

/// Resultado de compartir, para que la pantalla sepa si la imagen salió.
enum ResultadoCompartir { compartido, descargado, cancelado }

/// Comparte una imagen con el menú del sistema (WhatsApp, correo…) (ADR 0008,
/// D-18). Es la única forma en que el token de un QR sale de la app.
abstract interface class CompartirImagen {
  Future<ResultadoCompartir> compartirPng({
    required Uint8List bytes,
    required String nombreArchivo,
    required String texto,
  });
}

/// Implementación con `share_plus`. En web usa la Web Share API y, si el
/// navegador no la tiene, descarga la imagen (handoff §6).
class CompartirConSistema implements CompartirImagen {
  const new([this._descargar = const DescargarArchivo()]);

  final DescargarArchivo _descargar;

  @override
  Future<ResultadoCompartir> compartirPng({
    required Uint8List bytes,
    required String nombreArchivo,
    required String texto,
  }) async {
    final archivo = XFile.fromData(
      bytes,
      name: nombreArchivo,
      mimeType: 'image/png',
    );
    final resultado = await SharePlus.instance.share(
      ShareParams(files: [archivo], text: texto),
    );
    return switch (resultado.status) {
      ShareResultStatus.success => ResultadoCompartir.compartido,
      ShareResultStatus.dismissed => ResultadoCompartir.cancelado,
      ShareResultStatus.unavailable =>
        await _descargar.png(bytes: bytes, nombreArchivo: nombreArchivo)
            ? ResultadoCompartir.descargado
            : ResultadoCompartir.cancelado,
    };
  }
}

final compartirImagenProvider = Provider<CompartirImagen>(
  (ref) => const CompartirConSistema(),
);
