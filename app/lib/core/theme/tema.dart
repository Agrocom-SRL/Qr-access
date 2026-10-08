import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// `ThemeData` claro y oscuro armados desde los semánticos
/// (no con `fromSeed`, §2.3).
abstract final class Tema {
  static final ThemeData claro = _construir(
    ColoresSemanticos.claro,
    Brightness.light,
  );
  static final ThemeData oscuro = _construir(
    ColoresSemanticos.oscuro,
    Brightness.dark,
  );

  static ThemeData _construir(ColoresSemanticos c, Brightness brillo) {
    final tokens = AccesoTokens(colores: c);
    final esquema = ColorScheme(
      brightness: brillo,
      primary: c.primario,
      onPrimary: c.sobrePrimario,
      primaryContainer: c.primarioSuave,
      onPrimaryContainer: c.texto,
      secondary: c.primario,
      onSecondary: c.sobrePrimario,
      error: c.peligro,
      onError: c.sobrePrimario,
      surface: c.superficie,
      onSurface: c.texto,
      onSurfaceVariant: c.textoSecundario,
      outline: c.borde,
    );
    final radioControl = BorderRadius.circular(tokens.radio.m);
    return ThemeData(
      colorScheme: esquema,
      scaffoldBackgroundColor: c.fondo,
      extensions: [tokens],
      inputDecorationTheme: InputDecorationThemeData(
        border: OutlineInputBorder(borderRadius: radioControl),
        enabledBorder: OutlineInputBorder(
          borderRadius: radioControl,
          borderSide: BorderSide(color: c.borde),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: Size.fromHeight(tokens.tamano.controlMinimo),
          shape: RoundedRectangleBorder(borderRadius: radioControl),
        ),
      ),
    );
  }
}
