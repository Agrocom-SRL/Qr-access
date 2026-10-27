import 'dart:typed_data';

import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/plataforma/descargar_archivo.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

/// Comparte un archivo (la página de una exportación en CSV) con el menú del
/// sistema, o lo descarga si el navegador no tiene Web Share (ADR 0033 §3).
/// Quien llama decide qué hacer con el resultado: un `cancelado` no cuenta
/// como página entregada.
abstract interface class CompartirArchivo {
  Future<ResultadoCompartir> compartir({
    required Uint8List bytes,
    required String nombreArchivo,
    required String mimeType,
  });
}

/// Implementación con `share_plus`, igual que [CompartirConSistema] para el
/// PNG.
class CompartirArchivoConSistema implements CompartirArchivo {
  const new([this._descargar = const DescargarArchivo()]);

  final DescargarArchivo _descargar;

  @override
  Future<ResultadoCompartir> compartir({
    required Uint8List bytes,
    required String nombreArchivo,
    required String mimeType,
  }) async {
    final archivo = XFile.fromData(
      bytes,
      name: nombreArchivo,
      mimeType: mimeType,
    );
    final resultado = await SharePlus.instance.share(
      ShareParams(files: [archivo]),
    );
    return switch (resultado.status) {
      ShareResultStatus.success => ResultadoCompartir.compartido,
      ShareResultStatus.dismissed => ResultadoCompartir.cancelado,
      ShareResultStatus.unavailable =>
        await _descargar.archivo(
              bytes: bytes,
              nombreArchivo: nombreArchivo,
              mimeType: mimeType,
            )
            ? ResultadoCompartir.descargado
            : ResultadoCompartir.cancelado,
    };
  }
}

final compartirArchivoProvider = Provider<CompartirArchivo>(
  (ref) => const CompartirArchivoConSistema(),
);
