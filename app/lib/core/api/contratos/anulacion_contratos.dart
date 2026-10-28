/// Lo que devuelve `POST /qr-accesos/anulacion-masiva` (ADR 0033 §3): cuántos
/// usuarios alcanzó y cuántos QR vigentes anuló (0 si no había ninguno).
class AnulacionMasivaDto {
  const new({
    required this.id,
    required this.usuariosAlcanzados,
    required this.qrAnulados,
  });

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      usuariosAlcanzados = (json['usuarios_alcanzados'] as num).toInt(),
      qrAnulados = (json['qr_anulados'] as num).toInt();

  final String id;
  final int usuariosAlcanzados;
  final int qrAnulados;
}
