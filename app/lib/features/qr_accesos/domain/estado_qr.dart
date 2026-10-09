/// Estado de un QR emitido (ADR 0008). Los valores son los del contrato de la
/// API (`GET /qr-accesos?estado=`).
enum EstadoQr {
  vigente('vigente'),
  usado('usado'),
  vencido('vencido'),
  anulado('anulado');

  new(this.valorApi);

  /// Texto que espera la API en el parámetro `estado`.
  final String valorApi;

  /// Estado desde el texto de la API. Un valor desconocido es un error de
  /// contrato, no un dato a ocultar en silencio.
  static EstadoQr desdeApi(String valor) => EstadoQr.values.firstWhere(
    (estado) => estado.valorApi == valor,
    orElse: () => throw FormatException('Estado de QR desconocido: $valor'),
  );
}
