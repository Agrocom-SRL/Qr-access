import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

/// Descarga un archivo con un enlace temporal: el respaldo de la web cuando el
/// navegador no tiene Web Share API (handoff §6). Así bajan el PNG del QR y el
/// CSV de la exportación, sin guardar nada fuera del enlace.
class DescargarArchivo {
  const new();

  Future<bool> archivo({
    required Uint8List bytes,
    required String nombreArchivo,
    required String mimeType,
  }) async {
    final blob = web.Blob(
      [bytes.toJS].toJS,
      web.BlobPropertyBag(type: mimeType),
    );
    final url = web.URL.createObjectURL(blob);
    final enlace = web.HTMLAnchorElement()
      ..href = url
      ..download = nombreArchivo;
    web.document.body?.append(enlace);
    enlace
      ..click()
      ..remove();
    web.URL.revokeObjectURL(url);
    return true;
  }

  Future<bool> png({required Uint8List bytes, required String nombreArchivo}) =>
      archivo(
        bytes: bytes,
        nombreArchivo: nombreArchivo,
        mimeType: 'image/png',
      );
}
