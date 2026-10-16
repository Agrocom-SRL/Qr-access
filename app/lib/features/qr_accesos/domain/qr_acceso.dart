import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:flutter/foundation.dart';

/// Puerta a la que sirve un QR: solo `id` y nombre, como la devuelve la API.
@immutable
class PuertaDeQr {
  const new({required this.id, required this.nombre});

  final String id;
  final String nombre;
}

/// QR que la persona ya emitió, tal como aparece en el listado. No trae el
/// `texto` del token: ese solo llega al emitirlo (ADR 0008).
@immutable
class QrAcceso {
  const new({
    required this.id,
    required this.etiqueta,
    required this.estado,
    required this.venceAt,
    required this.usadoAt,
    required this.anuladoAt,
    required this.creadoAt,
    required this.puertas,
  });

  final String id;

  /// Nota libre de quien lo emitió (D-21). `null` si no se escribió una.
  final String? etiqueta;
  final EstadoQr estado;
  final DateTime venceAt;
  final DateTime? usadoAt;
  final DateTime? anuladoAt;
  final DateTime creadoAt;
  final List<PuertaDeQr> puertas;

  /// Solo un QR vigente se puede anular: los demás ya no abren nada.
  bool get puedeAnularse => estado == EstadoQr.vigente;

  /// Nombres de las puertas separados por " · " (handoff).
  String get nombresDePuertas => puertas.map((p) => p.nombre).join(' · ');
}

/// QR emitido. `texto` es el token en claro: el servidor no lo conserva (solo
/// su hash); el dispositivo que lo emitió lo guarda cifrado hasta que vence
/// para poder volver a mostrarlo (ADR 0008).
@immutable
class QrEmitido {
  const new({
    required this.id,
    required this.texto,
    required this.venceAt,
    required this.etiqueta,
    required this.puertas,
    this.repaso = false,
    this.respaldo = false,
  });

  final String id;
  final String texto;
  final DateTime venceAt;
  final String? etiqueta;
  final List<PuertaDeQr> puertas;

  /// `true` si se vuelve a abrir desde Mis QR: el QR ya se emitió y se puede
  /// ver de nuevo, así que cerrar no pide confirmación.
  final bool repaso;

  /// `true` si es el último QR propio guardado en el dispositivo, mostrado
  /// porque no hay conexión para emitir uno nuevo.
  final bool respaldo;

  String get nombresDePuertas => puertas.map((p) => p.nombre).join(' · ');
}
