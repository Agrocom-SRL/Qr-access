import 'dart:math';

/// Bytes de un UUID (RFC 4122): 128 bits.
const _bytesUuid = 16;

/// Genera la clave de idempotencia de un intento (cabecera `Idempotency-Key`,
/// ADR 0031 §11): un UUID v4 de los bytes que entrega [azar].
///
/// El azar se inyecta para probarlo con una semilla fija. En la app real es
/// `Random.secure()`: una clave predecible permitiría que otra solicitud
/// reciba la respuesta de la nuestra.
String generarClaveIdempotencia(Random azar) {
  final bytes = List<int>.generate(_bytesUuid, (_) => azar.nextInt(256));
  // Versión 4 en el nibble alto del byte 6 y variante RFC 4122 en los bits
  // altos del byte 8; sin esto el formato no es un UUID v4.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = [for (final b in bytes) b.toRadixString(16).padLeft(2, '0')]
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
      '${hex.substring(20)}';
}
