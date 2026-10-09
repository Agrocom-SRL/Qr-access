import 'package:agrocom_acceso/core/theme/primitivos.dart';
import 'package:flutter/material.dart';

/// Colores semánticos (docs/diseno/sistema-diseno.md §2.3): lo único de color
/// que leen los widgets.
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
    required this.qrModulo,
    required this.qrFondo,
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
    qrModulo: Primitivos.qrModulo,
    qrFondo: Primitivos.qrFondo,
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
    // El QR no cambia con el tema (sistema de diseño §1.8).
    qrModulo: Primitivos.qrModulo,
    qrFondo: Primitivos.qrFondo,
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

  /// Módulos y fondo del QR: negro sobre blanco en ambos temas.
  final Color qrModulo;
  final Color qrFondo;
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

/// Radios de esquina (§2.5).
@immutable
class Radios {
  const new();
  double get s => 6;
  double get m => 10;
  double get l => 14;
  double get xl => 20;
  double get completo => 999;
}

/// Duraciones de movimiento (§2.5).
@immutable
class Duraciones {
  const new();
  Duration get rapida => const Duration(milliseconds: 120);
  Duration get normal => const Duration(milliseconds: 200);
  Duration get lenta => const Duration(milliseconds: 300);
  Curve get curva => Curves.easeOutCubic;
}

/// Tamaños de componentes y de contenido. Cambiar la densidad es editar aquí.
@immutable
class Tamanos {
  const new();

  /// Alto mínimo de un control táctil (§2.5).
  double get controlMinimo => 44;

  /// Ancho máximo de un formulario centrado (inicio de sesión, emisión).
  double get formularioMaximo => 420;

  /// Ancho máximo del contenido de un listado en la web ancha.
  double get listadoMaximo => 1200;

  /// Lado mínimo del QR mostrado, en dp: se lee bien a distancia.
  double get qrMinimo => 240;

  /// Zona de silencio del QR, en módulos (la norma pide 4).
  int get qrZonaSilencioModulos => 4;

  /// Ícono de una fila o un botón.
  double get icono => 20;

  /// Ícono del resultado o de una pantalla vacía.
  double get iconoGrande => 48;

  /// Ancho mínimo de una tarjeta del listado antes de pasar a otra columna.
  double get tarjetaMinima => 280;
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

/// Acceso a los tokens desde cualquier widget: `context.tokens.espacio.m`.
extension TokensContexto on BuildContext {
  AccesoTokens get tokens => Theme.of(this).extension<AccesoTokens>()!;
}

/// Clase de pantalla según el ancho (§2.6): compacto, medio o expandido.
enum ClasePantalla { compacta, media, expandida }

extension ClasePantallaContexto on BuildContext {
  /// Clasifica el ancho disponible con los breakpoints del tema.
  ClasePantalla get clasePantalla {
    final ancho = MediaQuery.sizeOf(this).width;
    if (ancho >= tokens.breakpoint.expandido) return ClasePantalla.expandida;
    if (ancho >= tokens.breakpoint.medio) return ClasePantalla.media;
    return ClasePantalla.compacta;
  }
}
