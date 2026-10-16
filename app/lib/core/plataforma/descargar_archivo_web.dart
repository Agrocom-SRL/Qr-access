import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

/// Descarga un PNG con un enlace temporal: el respaldo de la web cuando el
/// navegador no tiene Web Share API (handoff §6).
class DescargarArchivo {
  const new();

  Future<bool> png({
    required Uint8List bytes,
    required String nombreArchivo,
  }) async {
    final blob = web.Blob(
      [bytes.toJS].toJS,
      web.BlobPropertyBag(type: 'image/png'),
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
}
