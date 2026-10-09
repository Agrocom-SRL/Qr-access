import 'dart:io';

import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:flutter_test/flutter_test.dart';

/// Peso máximo de la multimedia (ver `docs/CREDITOS.md`): protege el tiempo de
/// arranque y el tamaño de la app.
void main() {
  test('cada Lottie pesa menos de 50 KB', () {
    for (final ruta in [Multimedia.lottieSplash, Multimedia.lottieQrEmitido]) {
      expect(File(ruta).lengthSync(), lessThan(50 * 1024), reason: ruta);
    }
  });

  test('cada SVG pesa menos de 150 KB', () {
    for (final ruta in Multimedia.ilustraciones) {
      expect(File(ruta).lengthSync(), lessThan(150 * 1024), reason: ruta);
    }
  });

  test('todos los assets están declarados en el pubspec', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    for (final carpeta in ['assets/lottie/', 'assets/ilustraciones/']) {
      expect(pubspec, contains(carpeta));
    }
    expect(pubspec, contains('assets/logo/'));
  });

  test('docs/CREDITOS.md cita cada archivo multimedia', () {
    final creditos = File('../docs/CREDITOS.md').readAsStringSync();
    for (final ruta in [
      Multimedia.fotoBienvenida,
      Multimedia.fotoIngreso,
      Multimedia.logoPlaca,
      Multimedia.fondoSplash,
      Multimedia.fondoSplashOscuro,
      Multimedia.lottieSplash,
      Multimedia.lottieQrEmitido,
      ...Multimedia.ilustraciones,
    ]) {
      expect(creditos, contains(ruta.split('/').last), reason: ruta);
    }
  });
}
