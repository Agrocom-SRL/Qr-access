import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

/// Comparte una imagen con el menú del sistema (WhatsApp, correo…) (ADR 0008,
/// D-18). Es la única forma en que el token de un QR sale de la app.
abstract interface class CompartirImagen {
  Future<void> compartirPng({
    required Uint8List bytes,
    required String nombreArchivo,
    required String texto,
  });
}

/// Implementación con `share_plus`, que funciona igual en Android, iOS y web.
class CompartirConSistema implements CompartirImagen {
  const new();

  @override
  Future<void> compartirPng({
    required Uint8List bytes,
    required String nombreArchivo,
    required String texto,
  }) async {
    final archivo = XFile.fromData(
      bytes,
      name: nombreArchivo,
      mimeType: 'image/png',
    );
    await SharePlus.instance.share(ShareParams(files: [archivo], text: texto));
  }
}

final compartirImagenProvider = Provider<CompartirImagen>(
  (ref) => const CompartirConSistema(),
);
