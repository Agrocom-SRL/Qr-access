// AGROCOM Acceso · tokens de diseño V1 (punto de partida)
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AccesoVerde {
  static const v50 = Color(0xFFE8F5EE), v100 = Color(0xFFC5E6D2), v200 = Color(0xFF93D0AB),
      v300 = Color(0xFF5CB683), v400 = Color(0xFF2B9A5D), v500 = Color(0xFF007A33),
      v600 = Color(0xFF006B2D), v700 = Color(0xFF005824), v800 = Color(0xFF00451C), v900 = Color(0xFF002F13);
}

class AccesoEspacio {
  static const e2 = 2.0, e4 = 4.0, e8 = 8.0, e12 = 12.0, e16 = 16.0, e24 = 24.0, e32 = 32.0, e48 = 48.0;
}

class AccesoRadio {
  static const r6 = 6.0, r10 = 10.0, r14 = 14.0, r20 = 20.0, completo = 999.0;
}

class AccesoMedida {
  static const badge = 24.0, filtro = 40.0, tactilMin = 44.0, control = 48.0, appBar = 56.0,
      filaPerfil = 64.0, navBar = 80.0, railMedio = 80.0, railExpandido = 240.0,
      maxAuth = 400.0, maxFormulario = 720.0, maxContenido = 1200.0, qrMin = 240.0, qrSilencio = 16.0;
}

class AccesoBreakpoint {
  static const medio = 600.0, expandido = 1024.0;
}

class AccesoMovimiento {
  static const corta = Duration(milliseconds: 120), media = Duration(milliseconds: 200),
      larga = Duration(milliseconds: 300);
  static const curva = Curves.easeOutCubic;
  static Duration d(BuildContext c, Duration x) => MediaQuery.disableAnimationsOf(c) ? Duration.zero : x;
}

@immutable
class AccesoColores extends ThemeExtension<AccesoColores> {
  final Color fondo, superficie, superficieElevada, borde, texto, textoSecundario,
      primario, primarioHover, sobrePrimario, primarioSuave,
      peligro, peligroSuave, advertencia, advertenciaSuave, informacion, informacionSuave,
      hero, heroAcento;
  final List<BoxShadow> elev1, elev3;

  const AccesoColores({
    required this.fondo, required this.superficie, required this.superficieElevada, required this.borde,
    required this.texto, required this.textoSecundario, required this.primario, required this.primarioHover,
    required this.sobrePrimario, required this.primarioSuave, required this.peligro, required this.peligroSuave,
    required this.advertencia, required this.advertenciaSuave, required this.informacion,
    required this.informacionSuave, required this.hero, required this.heroAcento,
    required this.elev1, required this.elev3,
  });

  Color get accesoPermitido => primario;
  Color get accesoDenegado => peligro;

  static const claro = AccesoColores(
    fondo: Color(0xFFF5F7F6), superficie: Color(0xFFFFFFFF), superficieElevada: Color(0xFFFFFFFF),
    borde: Color(0xFFDDE2DF), texto: Color(0xFF1B1F1C), textoSecundario: Color(0xFF5B635D),
    primario: Color(0xFF007A33), primarioHover: Color(0xFF006B2D), sobrePrimario: Color(0xFFFFFFFF),
    primarioSuave: Color(0xFFE8F5EE), peligro: Color(0xFFC62828), peligroSuave: Color(0xFFFDECEC),
    advertencia: Color(0xFF965A00), advertenciaSuave: Color(0xFFFFF3E0),
    informacion: Color(0xFF1565C0), informacionSuave: Color(0xFFE8F1FB),
    hero: Color(0xFF007A33), heroAcento: Color(0xFF006B2D),
    elev1: [BoxShadow(color: Color(0x0F1B1F1C), blurRadius: 2, offset: Offset(0, 1)),
            BoxShadow(color: Color(0x0F1B1F1C), blurRadius: 3, offset: Offset(0, 1))],
    elev3: [BoxShadow(color: Color(0x1A1B1F1C), blurRadius: 24, offset: Offset(0, 8)),
            BoxShadow(color: Color(0x0A1B1F1C), blurRadius: 4, offset: Offset(0, 2))],
  );

  static const oscuro = AccesoColores(
    fondo: Color(0xFF121614), superficie: Color(0xFF1C211E), superficieElevada: Color(0xFF242A26),
    borde: Color(0xFF2C332E), texto: Color(0xFFE6EAE7), textoSecundario: Color(0xFFA3ABA5),
    primario: Color(0xFF5CB683), primarioHover: Color(0xFF93D0AB), sobrePrimario: Color(0xFF002F13),
    primarioSuave: Color(0xFF002F13), peligro: Color(0xFFEF7A7A), peligroSuave: Color(0xFF3A1C1C),
    advertencia: Color(0xFFF2B54A), advertenciaSuave: Color(0xFF33270F),
    informacion: Color(0xFF7EB6F2), informacionSuave: Color(0xFF14263A),
    hero: Color(0xFF00451C), heroAcento: Color(0xFF005824),
    elev1: [], elev3: [], // en oscuro la elevación es superficie / superficieElevada
  );

  @override
  AccesoColores copyWith() => this;

  @override
  AccesoColores lerp(ThemeExtension<AccesoColores>? other, double t) => t < 0.5 ? this : (other as AccesoColores);
}

extension AccesoTemaX on BuildContext {
  AccesoColores get ac => Theme.of(this).extension<AccesoColores>()!;
}

class AccesoTema {
  static ThemeData _base(AccesoColores c, Brightness b) {
    final sans = GoogleFonts.ibmPlexSansTextTheme();
    final text = sans.copyWith(
      headlineLarge: sans.headlineLarge?.copyWith(fontSize: 32, fontWeight: FontWeight.w600, height: 1.3),
      headlineMedium: sans.headlineMedium?.copyWith(fontSize: 24, fontWeight: FontWeight.w600, height: 1.3),
      titleLarge: sans.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w600, height: 1.3),
      bodyLarge: sans.bodyLarge?.copyWith(fontSize: 16, fontWeight: FontWeight.w400, height: 1.5),
      bodyMedium: sans.bodyMedium?.copyWith(fontSize: 14, fontWeight: FontWeight.w400, height: 1.5),
      labelSmall: sans.labelSmall?.copyWith(fontSize: 12, fontWeight: FontWeight.w500),
    ).apply(bodyColor: c.texto, displayColor: c.texto);

    return ThemeData(
      useMaterial3: true,
      brightness: b,
      scaffoldBackgroundColor: c.fondo,
      colorScheme: ColorScheme(
        brightness: b, primary: c.primario, onPrimary: c.sobrePrimario,
        primaryContainer: c.primarioSuave, onPrimaryContainer: c.primario,
        secondary: c.primario, onSecondary: c.sobrePrimario,
        error: c.peligro, onError: b == Brightness.light ? Colors.white : const Color(0xFF3A1C1C),
        surface: c.superficie, onSurface: c.texto, onSurfaceVariant: c.textoSecundario,
        outline: c.borde, outlineVariant: c.borde,
      ),
      textTheme: text,
      extensions: [c],
      materialTapTargetSize: MaterialTapTargetSize.padded,
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
        minimumSize: const Size(0, AccesoMedida.control),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      )),
      inputDecorationTheme: InputDecorationTheme(
        filled: true, fillColor: c.superficie,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(AccesoRadio.r10), borderSide: BorderSide(color: c.borde)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AccesoRadio.r10), borderSide: BorderSide(color: c.borde)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AccesoRadio.r10), borderSide: BorderSide(color: c.primario, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AccesoRadio.r10), borderSide: BorderSide(color: c.peligro, width: 2)),
      ),
      cardTheme: CardThemeData(color: c.superficie, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AccesoRadio.r14))),
      dialogTheme: DialogThemeData(backgroundColor: c.superficieElevada, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AccesoRadio.r20))),
      navigationBarTheme: NavigationBarThemeData(backgroundColor: c.superficie, indicatorColor: c.primarioSuave, height: AccesoMedida.navBar),
      navigationRailTheme: NavigationRailThemeData(backgroundColor: c.superficie, indicatorColor: c.primarioSuave),
    );
  }

  static final claro = _base(AccesoColores.claro, Brightness.light);
  static final oscuro = _base(AccesoColores.oscuro, Brightness.dark);

  /// Estilo mono para PIN, códigos, horas y cifras.
  static TextStyle mono(double size, {FontWeight w = FontWeight.w500, Color? color}) =>
      GoogleFonts.ibmPlexMono(fontSize: size, fontWeight: w, color: color, fontFeatures: const [FontFeature.tabularFigures()]);
}
