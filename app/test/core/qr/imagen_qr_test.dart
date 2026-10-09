import 'dart:typed_data';

import 'package:agrocom_acceso/core/qr/imagen_qr.dart';
import 'package:agrocom_acceso/core/qr/pintor_qr.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Firma de un PNG: los 8 bytes que abren cualquier archivo PNG.
const _firmaPng = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

void main() {
  testWidgets('la imagen compartida es un PNG de 1080×1350', (tester) async {
    final bytes = await tester.runAsync<Uint8List>(
      () => renderizarQrPng(
        texto: 'AQ1.token-de-prueba',
        textos: const TextosDeImagenQr(
          titulo: 'Proveedor de gas',
          puertas: 'Portón vehicular · Acceso peatonal',
          vencimiento: 'Vence hoy a las 23:59',
        ),
        colorModulo: const Color(0xFF000000),
        colorFondo: const Color(0xFFFFFFFF),
        colorTexto: const Color(0xFF1B1F1C),
        colorTextoSecundario: const Color(0xFF5B635D),
        familiaDeLetra: 'IBMPlexSans',
        zonaSilencioModulos: 4,
      ),
    );

    expect(bytes, isNotNull);
    expect(bytes!.take(_firmaPng.length), _firmaPng);
    // Ancho y alto del PNG (bytes 16–23 del encabezado IHDR, big endian).
    final datos = ByteData.sublistView(bytes);
    expect(datos.getUint32(16), MedidasDeImagenQr.ancho);
    expect(datos.getUint32(20), MedidasDeImagenQr.alto);
  });

  test('la matriz del QR trae el marcador de la esquina superior', () {
    final imagen = crearImagenQr('AQ1.token-de-prueba');
    expect(imagen.moduleCount, greaterThanOrEqualTo(21));
    expect(imagen.isDark(0, 0), isTrue, reason: 'marcador de posición');
  });
}
