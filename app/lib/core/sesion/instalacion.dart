import 'dart:math';

import 'package:flutter/foundation.dart';

/// Reglas puras de la instalación de este aparato (ADR 0030 §4.1). Sin
/// almacén ni red: se prueban solas.

/// Largo del identificador en bytes: un UUID v4 tiene 128 bits.
const _bytesDeUuid = 16;

/// Posición del byte que lleva la versión (4) y del que lleva la variante del
/// UUID (RFC 4122).
const _posicionVersion = 6;
const _posicionVariante = 8;
const _mascaraVersion = 0x0f;
const _versionCuatro = 0x40;
const _mascaraVariante = 0x3f;
const _variante = 0x80;

/// Cortes de un UUID en su forma 8-4-4-4-12 (con guiones).
const _cortes = [8, 12, 16, 20];

/// Lo que el servidor acepta como `instalacion_id`: 16 a 64 caracteres URL-safe
/// (`SesionSchemas` de la API). Un UUID con guiones cabe de sobra.
final _patronInstalacionId = RegExp(r'^[A-Za-z0-9_-]{16,64}$');

/// Un UUID v4 aleatorio con su forma 8-4-4-4-12. El azar se inyecta para que
/// los tests sean deterministas; en la app es `Random.secure()`.
String generarInstalacionId(Random azar) {
  final bytes = List<int>.generate(_bytesDeUuid, (_) => azar.nextInt(256));
  bytes[_posicionVersion] =
      (bytes[_posicionVersion] & _mascaraVersion) | _versionCuatro;
  bytes[_posicionVariante] =
      (bytes[_posicionVariante] & _mascaraVariante) | _variante;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return [
    hex.substring(0, _cortes[0]),
    hex.substring(_cortes[0], _cortes[1]),
    hex.substring(_cortes[1], _cortes[2]),
    hex.substring(_cortes[2], _cortes[3]),
    hex.substring(_cortes[3]),
  ].join('-');
}

/// `true` si el texto sirve como `instalacion_id`. Un valor dañado o ajeno al
/// formato se descarta y se genera otro.
bool esInstalacionIdValido(String valor) =>
    _patronInstalacionId.hasMatch(valor);

/// La plataforma que se declara al iniciar sesión (`android`, `ios` o `web`,
/// ADR 0030 §4.1). `null` en otras plataformas de escritorio: el campo es
/// opcional y la API no lo exige.
String? plataformaDe({required bool web, required TargetPlatform plataforma}) {
  if (web) return 'web';
  return switch (plataforma) {
    TargetPlatform.android => 'android',
    TargetPlatform.iOS => 'ios',
    _ => null,
  };
}
