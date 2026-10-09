import 'package:flutter/painting.dart';

/// ÚNICO lugar con valores literales de color
/// (docs/diseno/sistema-diseno.md §2). Cambiar la marca es editar este
/// archivo y nada más.
abstract final class Primitivos {
  // Verde de la bandera de Santa Cruz (D-08: hex provisional #007A33)
  static const verde50 = Color(0xFFE8F5EE);
  static const verde100 = Color(0xFFC5E6D2);
  static const verde200 = Color(0xFF93D0AB);
  static const verde300 = Color(0xFF5CB683);
  static const verde400 = Color(0xFF2B9A5D);
  static const verde500 = Color(0xFF007A33);
  static const verde600 = Color(0xFF006B2D);
  static const verde700 = Color(0xFF005824);
  static const verde800 = Color(0xFF00451C);
  static const verde900 = Color(0xFF002F13);

  static const neutro0 = Color(0xFFFFFFFF);
  static const neutro50 = Color(0xFFF5F7F6);
  static const neutro200 = Color(0xFFDDE2DF);
  static const neutro600 = Color(0xFF5B635D);
  static const neutro900 = Color(0xFF1B1F1C);
  static const neutroOscuro50 = Color(0xFF121614);
  static const neutroOscuro100 = Color(0xFF1C211E);
  static const neutroOscuroBorde = Color(0xFF2C332E);
  static const neutroOscuro300 = Color(0xFFA3ABA5);
  static const neutroOscuro400 = Color(0xFFE6EAE7);

  static const rojo600 = Color(0xFFC62828);
  static const rojo300 = Color(0xFFEF7A7A);
  static const ambar700 = Color(0xFF965A00);
  static const ambar300 = Color(0xFFF2B54A);
  static const azul700 = Color(0xFF1565C0);
  static const azul300 = Color(0xFF7EB6F2);

  /// El QR no se tematiza: negro sobre blanco siempre (§1.8).
  static const qrModulo = Color(0xFF000000);
  static const qrFondo = Color(0xFFFFFFFF);
}
