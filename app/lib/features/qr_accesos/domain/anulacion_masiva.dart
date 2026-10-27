import 'package:flutter/foundation.dart';

/// Anulación masiva de mis QR vigentes y los de mi rama (ADR 0031 §3, ADR 0033
/// §3). Anular es destructivo: un QR anulado no vuelve. Por eso el motivo es
/// obligatorio y el diálogo no manda nada hasta que se confirma.

/// Largo máximo del motivo: lo mismo que la API (`MAX_MOTIVO_DE_ANULACION`).
const maxMotivoDeAnulacion = 200;

/// El motivo sin espacios sobrantes, o `null` si está vacío o se pasa del
/// largo máximo.
String? motivoDeAnulacion(String texto) {
  final limpio = texto.trim();
  if (limpio.isEmpty || limpio.length > maxMotivoDeAnulacion) return null;
  return limpio;
}

/// Lo que devuelve la API: cuántos QR vigentes se anularon (0 si no había
/// ninguno) y a cuántos usuarios alcanzó el pedido.
@immutable
class ResultadoDeAnulacionMasiva {
  const new({required this.qrAnulados, required this.usuariosAlcanzados});

  final int qrAnulados;
  final int usuariosAlcanzados;
}
