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

  /// El último QR propio emitido con conexión, o `null` si no hay o ya venció.
  /// Es el respaldo de emergencia: se usa solo sin internet y se reemplaza en
  /// cada emisión propia exitosa.
  Future<QrPropioGuardado?> leerUltimoPropio();

  Future<void> guardarUltimoPropio(QrPropioGuardado qr);

  /// Descarta el respaldo si es el QR [id] (porque se anuló).
  Future<void> borrarUltimoPropio(String id);
}

/// Lo mínimo de un QR propio para volver a mostrarlo sin red.
class QrPropioGuardado {
  const new({
    required this.id,
    required this.texto,
    required this.venceAt,
    required this.etiqueta,
    required this.puertas,
  });

  final String id;
  final String texto;
  final DateTime venceAt;
  final String? etiqueta;

  /// `(id, nombre)` de cada puerta que abre.
  final List<({String id, String nombre})> puertas;
}
