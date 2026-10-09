import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/pintor_qr.dart';
import 'package:flutter/material.dart';

/// Lado de la imagen PNG que se comparte, en píxeles: lo bastante grande para
/// que se lea aunque WhatsApp la recomprima.
const ladoPngQr = 1024;

/// Pinta el QR de `texto` en un PNG de [ladoPngQr] píxeles, con la misma zona
/// de silencio y colores que en pantalla (ADR 0008, sistema de diseño §5).
Future<Uint8List> renderizarQrPng({
  required String texto,
  required Color colorModulo,
  required Color colorFondo,
  required int zonaSilencioModulos,
}) async {
  final grabador = ui.PictureRecorder();
  final lienzo = Canvas(grabador);
  PintorQr(
    imagen: crearImagenQr(texto),
    zonaSilencioModulos: zonaSilencioModulos,
    colorModulo: colorModulo,
    colorFondo: colorFondo,
  ).paint(lienzo, Size.square(ladoPngQr.toDouble()));
  final imagen = await grabador.endRecording().toImage(ladoPngQr, ladoPngQr);
  final bytes = await imagen.toByteData(format: ui.ImageByteFormat.png);
  if (bytes == null) throw StateError('No se pudo codificar el QR en PNG');
  return bytes.buffer.asUint8List();
}
