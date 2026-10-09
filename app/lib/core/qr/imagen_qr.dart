import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:agrocom_acceso/core/qr/pintor_qr.dart';
import 'package:flutter/material.dart';

/// Medidas de la imagen PNG que se comparte (handoff: 1080×1350 con el QR,
/// la etiqueta, las puertas y el vencimiento). Son píxeles de la imagen, no
/// medidas de pantalla, por eso no salen de los tokens.
abstract final class MedidasDeImagenQr {
  static const ancho = 1080;
  static const alto = 1350;
  static const ladoQr = 860.0;
  static const margen = 110.0;
  static const tamanoTitulo = 56.0;
  static const tamanoTexto = 40.0;
  static const separacion = 28.0;
}

/// Textos que acompañan al QR en la imagen, ya traducidos por la pantalla.
class TextosDeImagenQr {
  const new({
    required this.titulo,
    required this.puertas,
    required this.vencimiento,
  });

  final String titulo;
  final String puertas;
  final String vencimiento;
}

/// Pinta el QR de `texto` en un PNG de 1080×1350 con la misma zona de
/// silencio y colores que en pantalla, más los textos debajo (ADR 0008).
Future<Uint8List> renderizarQrPng({
  required String texto,
  required TextosDeImagenQr textos,
  required Color colorModulo,
  required Color colorFondo,
  required Color colorTexto,
  required Color colorTextoSecundario,
  required String familiaDeLetra,
  required int zonaSilencioModulos,
}) async {
  final grabador = ui.PictureRecorder();
  final lienzo = Canvas(grabador);
  final ancho = MedidasDeImagenQr.ancho.toDouble();
  final alto = MedidasDeImagenQr.alto.toDouble();
  lienzo.drawRect(
    Rect.fromLTWH(0, 0, ancho, alto),
    Paint()..color = colorFondo,
  );

  final pintor = PintorQr(
    imagen: crearImagenQr(texto),
    zonaSilencioModulos: zonaSilencioModulos,
    colorModulo: colorModulo,
    colorFondo: colorFondo,
  );
  final origenQr = Offset(
    (ancho - MedidasDeImagenQr.ladoQr) / 2,
    MedidasDeImagenQr.margen,
  );
  pintor.pintarModulos(lienzo, origenQr, MedidasDeImagenQr.ladoQr);

  var y = origenQr.dy + MedidasDeImagenQr.ladoQr + MedidasDeImagenQr.separacion;
  for (final (contenido, tamano, color, peso) in [
    (
      textos.titulo,
      MedidasDeImagenQr.tamanoTitulo,
      colorTexto,
      FontWeight.w600,
    ),
    (
      textos.puertas,
      MedidasDeImagenQr.tamanoTexto,
      colorTextoSecundario,
      FontWeight.w400,
    ),
    (
      textos.vencimiento,
      MedidasDeImagenQr.tamanoTexto,
      colorTexto,
      FontWeight.w500,
    ),
  ]) {
    final pintorTexto = TextPainter(
      text: TextSpan(
        text: contenido,
        style: TextStyle(
          fontFamily: familiaDeLetra,
          fontSize: tamano,
          fontWeight: peso,
          color: color,
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
      maxLines: 2,
      ellipsis: '…',
    )..layout(maxWidth: ancho - 2 * MedidasDeImagenQr.margen);
    pintorTexto.paint(lienzo, Offset((ancho - pintorTexto.width) / 2, y));
    y += pintorTexto.height + MedidasDeImagenQr.separacion;
  }

  final imagen = await grabador.endRecording().toImage(
    MedidasDeImagenQr.ancho,
    MedidasDeImagenQr.alto,
  );
  final bytes = await imagen.toByteData(format: ui.ImageByteFormat.png);
  if (bytes == null) throw StateError('No se pudo codificar el QR en PNG');
  return bytes.buffer.asUint8List();
}
