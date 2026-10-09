import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/imagen_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/pintor_qr.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Firma de un PNG: los 8 bytes que abren cualquier archivo PNG.
const _firmaPng = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

void main() {
  testWidgets('la imagen compartida es un PNG', (tester) async {
    final bytes = await tester.runAsync(
      () => renderizarQrPng(
        texto: 'AQ1.token-de-prueba',
        colorModulo: const Color(0xFF000000),
        colorFondo: const Color(0xFFFFFFFF),
        zonaSilencioModulos: 4,
      ),
    );

    expect(bytes, isNotNull);
    expect(bytes!.take(_firmaPng.length), _firmaPng);
  });

  test('la matriz del QR trae el marcador de la esquina superior', () {
    final imagen = crearImagenQr('AQ1.token-de-prueba');
    expect(imagen.moduleCount, greaterThanOrEqualTo(21));
    expect(imagen.isDark(0, 0), isTrue, reason: 'marcador de posición');
  });
}
