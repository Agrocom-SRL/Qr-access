/// Guarda en el dispositivo el texto de los QR que la persona emitió, para
/// poder volver a mostrarlos desde "Mis QR" mientras sigan vigentes.
///
/// El servidor solo conserva el hash del token (ADR 0008): el texto no se
/// puede recuperar de la API, así que solo existe donde se emitió. Cada
/// entrada se descarta sola al vencer el QR.
abstract interface class AlmacenQr {
  /// El texto del QR [id], o `null` si no está aquí o ya venció.
  Future<String?> leer(String id);

  Future<void> guardar(String id, String texto, DateTime venceAt);

  Future<void> borrar(String id);
}
