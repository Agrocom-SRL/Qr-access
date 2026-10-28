import 'dart:typed_data';

/// En móvil no hay "descarga": el menú de compartir siempre existe, así que
/// este respaldo nunca se usa.
class DescargarArchivo {
  const new();

  Future<bool> archivo({
    required Uint8List bytes,
    required String nombreArchivo,
    required String mimeType,
  }) async => false;

  Future<bool> png({
    required Uint8List bytes,
    required String nombreArchivo,
  }) async => false;
}
