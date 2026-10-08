import 'package:agrocom_acceso/core/theme/primitivos.dart';
import 'package:flutter/material.dart';

/// Colores semánticos (§2.3): lo único de color que leen los widgets.
@immutable
class ColoresSemanticos {
  const new({
    required this.fondo,
    required this.superficie,
    required this.texto,
    required this.textoSecundario,
    required this.borde,
    required this.primario,
    required this.sobrePrimario,
    required this.primarioSuave,
    required this.exito,
    required this.advertencia,
    required this.peligro,
    required this.informacion,
    required this.accesoPermitido,
    required this.accesoDenegado,
  });

  static const claro = ColoresSemanticos(
    fondo: Primitivos.neutro50,
    superficie: Primitivos.neutro0,
    texto: Primitivos.neutro900,
    textoSecundario: Primitivos.neutro600,
    borde: Primitivos.neutro200,
    primario: Primitivos.verde500,
    sobrePrimario: Primitivos.neutro0,
    primarioSuave: Primitivos.verde50,
    exito: Primitivos.verde600,
    advertencia: Primitivos.ambar700,
    peligro: Primitivos.rojo600,
    informacion: Primitivos.azul700,
    accesoPermitido: Primitivos.verde500,
    accesoDenegado: Primitivos.rojo600,
  );

  static const oscuro = ColoresSemanticos(
    fondo: Primitivos.neutroOscuro50,
    superficie: Primitivos.neutroOscuro100,
    texto: Primitivos.neutroOscuro400,
    textoSecundario: Primitivos.neutroOscuro300,
    borde: Primitivos.neutroOscuroBorde,
    primario: Primitivos.verde300,
    sobrePrimario: Primitivos.neutroOscuro50,
    primarioSuave: Primitivos.verde900,
    exito: Primitivos.verde300,
    advertencia: Primitivos.ambar300,
    peligro: Primitivos.rojo300,
    informacion: Primitivos.azul300,
    accesoPermitido: Primitivos.verde300,
    accesoDenegado: Primitivos.rojo300,
  );

  final Color fondo;
  final Color superficie;
  final Color texto;
  final Color textoSecundario;
  final Color borde;
  final Color primario;
  final Color sobrePrimario;
  final Color primarioSuave;
  final Color exito;
  final Color advertencia;
  final Color peligro;
  final Color informacion;
  final Color accesoPermitido;
  final Color accesoDenegado;
}

/// Espaciado en base 4 (§2.5).
@immutable
class Espacios {
  const new();
  double get xxs => 2;
  double get xs => 4;
  double get s => 8;
  double get m => 12;
  double get l => 16;
  double get xl => 24;
  double get xxl => 32;
  double get xxxl => 48;
}

@immutable
class Radios {
  const new();
  double get s => 6;
  double get m => 10;
  double get l => 14;
  double get xl => 20;
  double get completo => 999;
}

@immutable
class Duraciones {
  const new();
  Duration get rapida => const Duration(milliseconds: 120);
  Duration get normal => const Duration(milliseconds: 200);
  Duration get lenta => const Duration(milliseconds: 300);
  Curve get curva => Curves.easeOutCubic;
}

@immutable
class Tamanos {
  const new();

  /// Alto mínimo de un control táctil.
  double get controlMinimo => 44;

  /// Ancho máximo de un formulario centrado (inicio de sesión).
  double get formularioMaximo => 420;
}

/// Breakpoints (§2.6): ningún otro número.
@immutable
class Breakpoints {
  const new();
  double get medio => 600;
  double get expandido => 1024;
}

/// Tokens del sistema de diseño (ADR 0012), disponibles con `context.tokens`.
@immutable
class AccesoTokens extends ThemeExtension<AccesoTokens> {
  const new({required this.colores});

  final ColoresSemanticos colores;
  Espacios get espacio => const Espacios();
  Radios get radio => const Radios();
  Duraciones get duracion => const Duraciones();
  Tamanos get tamano => const Tamanos();
  Breakpoints get breakpoint => const Breakpoints();

  @override
  AccesoTokens copyWith({ColoresSemanticos? colores}) =>
      AccesoTokens(colores: colores ?? this.colores);

  @override
  AccesoTokens lerp(AccesoTokens? other, double t) =>
      t < 0.5 || other == null ? this : other;
}

extension TokensContexto on BuildContext {
  AccesoTokens get tokens => Theme.of(this).extension<AccesoTokens>()!;
}
