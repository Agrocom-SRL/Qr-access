import 'package:flutter/material.dart';
import 'package:qr/qr.dart';

/// Genera la matriz del QR de `texto` con corrección de errores M (sistema de
/// diseño §5: tolera un 15 % de daño). Es el mismo dibujo para la pantalla y
/// para la imagen que se comparte.
QrImage crearImagenQr(String texto) =>
    QrImage(QrCode(payload: QrPayload.fromString(texto)));

/// Dibuja un QR como módulos de `colorModulo` sobre `colorFondo`, con zona de
/// silencio de `zonaSilencioModulos` módulos alrededor (ADR 0008). Sin
/// redondeos ni logo: un lector económico lo lee mejor así.
class PintorQr extends CustomPainter {
  const new({
    required this.imagen,
    required this.zonaSilencioModulos,
    required this.colorModulo,
    required this.colorFondo,
  });

  final QrImage imagen;
  final int zonaSilencioModulos;
  final Color colorModulo;
  final Color colorFondo;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = colorFondo);
    final modulosTotales = imagen.moduleCount + 2 * zonaSilencioModulos;
    final lado = size.shortestSide / modulosTotales;
    final pincel = Paint()..color = colorModulo;
    for (var fila = 0; fila < imagen.moduleCount; fila++) {
      for (var columna = 0; columna < imagen.moduleCount; columna++) {
        if (!imagen.isDark(fila, columna)) continue;
        final x = (columna + zonaSilencioModulos) * lado;
        final y = (fila + zonaSilencioModulos) * lado;
        canvas.drawRect(Rect.fromLTWH(x, y, lado, lado), pincel);
      }
    }
  }

  @override
  bool shouldRepaint(PintorQr antiguo) =>
      antiguo.imagen != imagen ||
      antiguo.zonaSilencioModulos != zonaSilencioModulos ||
      antiguo.colorModulo != colorModulo ||
      antiguo.colorFondo != colorFondo;
}
