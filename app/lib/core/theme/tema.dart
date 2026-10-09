import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// `ThemeData` claro y oscuro armados desde los semánticos (no con
/// `fromSeed`, §2.3) y con los componentes de Material 3 ajustados a las
/// medidas del handoff (botón y campo 48, radios 10/14/20, NavigationBar 80).
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
    final tipo = tokens.tipografia;
    final tamano = tokens.tamano;
    final esquema = ColorScheme(
      brightness: brillo,
      primary: c.primario,
      onPrimary: c.sobrePrimario,
      primaryContainer: c.primarioSuave,
      onPrimaryContainer: c.primario,
      secondary: c.primario,
      onSecondary: c.sobrePrimario,
      secondaryContainer: c.primarioSuave,
      onSecondaryContainer: c.primario,
      error: c.peligro,
      onError: c.sobrePrimario,
      errorContainer: c.peligroSuave,
      onErrorContainer: c.peligro,
      surface: c.superficie,
      onSurface: c.texto,
      surfaceContainerHighest: c.fondo,
      surfaceContainerHigh: c.superficieElevada,
      onSurfaceVariant: c.textoSecundario,
      outline: c.borde,
      outlineVariant: c.borde,
      shadow: c.elev1.isEmpty ? c.fondo : c.elev1.first.color,
    );

    TextStyle sans(double tamano, FontWeight peso, double interlineado) =>
        TextStyle(
          fontFamily: tipo.familia,
          fontSize: tamano,
          fontWeight: peso,
          height: interlineado,
          color: c.texto,
        );
    final titulos = tipo.interlineadoTitulo;
    final cuerpo = tipo.interlineadoCuerpo;
    final textos = TextTheme(
      headlineLarge: sans(tipo.t32, tipo.semiNegrita, titulos),
      headlineMedium: sans(tipo.t24, tipo.semiNegrita, titulos),
      headlineSmall: sans(tipo.t20, tipo.semiNegrita, titulos),
      titleLarge: sans(tipo.t20, tipo.semiNegrita, titulos),
      titleMedium: sans(tipo.t16, tipo.semiNegrita, titulos),
      titleSmall: sans(tipo.t14, tipo.semiNegrita, titulos),
      bodyLarge: sans(tipo.t16, tipo.regular, cuerpo),
      bodyMedium: sans(tipo.t14, tipo.regular, cuerpo),
      bodySmall: sans(tipo.t12, tipo.regular, cuerpo),
      labelLarge: sans(tipo.t16, tipo.semiNegrita, titulos),
      labelMedium: sans(tipo.t14, tipo.medio, titulos),
      labelSmall: sans(tipo.t12, tipo.medio, titulos),
    );

    final radioCampo = BorderRadius.circular(tokens.radio.m);
    OutlineInputBorder borde(Color color, double ancho) => OutlineInputBorder(
      borderRadius: radioCampo,
      borderSide: BorderSide(color: color, width: ancho),
    );
    final alturaControl = Size(0, tamano.control);
    final textoBoton = textos.labelLarge;

    return ThemeData(
      useMaterial3: true,
      brightness: brillo,
      colorScheme: esquema,
      scaffoldBackgroundColor: c.fondo,
      canvasColor: c.superficie,
      dividerColor: c.borde,
      fontFamily: tipo.familia,
      textTheme: textos,
      extensions: [tokens],
      materialTapTargetSize: MaterialTapTargetSize.padded,
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: c.fondo,
        foregroundColor: c.texto,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: tamano.appBar,
        centerTitle: false,
        titleTextStyle: textos.headlineSmall,
        iconTheme: IconThemeData(color: c.texto, size: tamano.iconoNav),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: alturaControl,
          shape: const StadiumBorder(),
          textStyle: textoBoton,
          backgroundColor: c.primario,
          foregroundColor: c.sobrePrimario,
          disabledBackgroundColor: c.borde,
          disabledForegroundColor: c.textoSecundario,
          padding: EdgeInsets.symmetric(horizontal: tokens.espacio.xl),
        ).copyWith(overlayColor: WidgetStatePropertyAll(c.primarioHover)),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: alturaControl,
          shape: const StadiumBorder(),
          textStyle: textoBoton,
          foregroundColor: c.primario,
          side: BorderSide(color: c.borde),
          padding: EdgeInsets.symmetric(horizontal: tokens.espacio.xl),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: Size(0, tamano.controlMinimo),
          shape: const StadiumBorder(),
          textStyle: textoBoton,
          foregroundColor: c.primario,
          padding: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: c.texto,
          minimumSize: Size.square(tamano.controlMinimo),
        ),
      ),
      inputDecorationTheme: InputDecorationThemeData(
        filled: true,
        fillColor: c.superficie,
        border: borde(c.borde, tamano.bordeFino),
        enabledBorder: borde(c.borde, tamano.bordeFino),
        focusedBorder: borde(c.primario, tamano.bordeFoco),
        errorBorder: borde(c.peligro, tamano.bordeFoco),
        focusedErrorBorder: borde(c.peligro, tamano.bordeFoco),
        disabledBorder: borde(c.borde, tamano.bordeFino),
        hintStyle: textos.bodyLarge?.copyWith(color: c.textoSecundario),
        labelStyle: textos.bodyMedium?.copyWith(color: c.textoSecundario),
        helperStyle: textos.bodySmall?.copyWith(color: c.textoSecundario),
        errorStyle: textos.bodySmall?.copyWith(color: c.peligro),
        contentPadding: EdgeInsets.symmetric(
          horizontal: tokens.espacio.l,
          vertical: tokens.espacio.m,
        ),
      ),
      cardTheme: CardThemeData(
        color: c.superficie,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radio.l),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.superficieElevada,
        surfaceTintColor: c.superficieElevada,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radio.xl),
        ),
        titleTextStyle: textos.headlineSmall,
        contentTextStyle: textos.bodyMedium?.copyWith(color: c.textoSecundario),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.superficieElevada,
        surfaceTintColor: c.superficieElevada,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(tokens.radio.xl),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.superficie,
        indicatorColor: c.primarioSuave,
        height: tamano.navBar,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (estados) => textos.labelSmall?.copyWith(
            color: estados.contains(WidgetState.selected)
                ? c.texto
                : c.textoSecundario,
            fontWeight: estados.contains(WidgetState.selected)
                ? tipo.semiNegrita
                : tipo.medio,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (estados) => IconThemeData(
            size: tamano.iconoNav,
            color: estados.contains(WidgetState.selected)
                ? c.primario
                : c.textoSecundario,
          ),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: c.superficie,
        indicatorColor: c.primarioSuave,
        elevation: 0,
        selectedIconTheme: IconThemeData(
          color: c.primario,
          size: tamano.iconoNav,
        ),
        unselectedIconTheme: IconThemeData(
          color: c.textoSecundario,
          size: tamano.iconoNav,
        ),
        selectedLabelTextStyle: textos.labelMedium?.copyWith(
          color: c.texto,
          fontWeight: tipo.semiNegrita,
        ),
        unselectedLabelTextStyle: textos.labelMedium?.copyWith(
          color: c.textoSecundario,
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radio.s),
        ),
        side: BorderSide(color: c.textoSecundario, width: tamano.bordeFoco),
        fillColor: WidgetStateProperty.resolveWith(
          (estados) =>
              estados.contains(WidgetState.selected) ? c.primario : null,
        ),
        checkColor: WidgetStatePropertyAll(c.sobrePrimario),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (estados) => estados.contains(WidgetState.selected)
              ? c.primario
              : c.textoSecundario,
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (estados) => estados.contains(WidgetState.selected)
              ? c.sobrePrimario
              : c.textoSecundario,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (estados) => estados.contains(WidgetState.selected)
              ? c.primario
              : c.superficie,
        ),
        trackOutlineColor: WidgetStateProperty.resolveWith(
          (estados) => estados.contains(WidgetState.selected)
              ? c.primario
              : c.textoSecundario,
        ),
      ),
      dividerTheme: DividerThemeData(
        color: c.borde,
        thickness: tamano.bordeFino,
        space: tamano.bordeFino,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: c.textoSecundario,
        textColor: c.texto,
        minTileHeight: tamano.filaPerfil,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: c.primario),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.texto,
        contentTextStyle: textos.bodyMedium?.copyWith(color: c.superficie),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(tokens.radio.m),
        ),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: c.texto,
          borderRadius: BorderRadius.circular(tokens.radio.s),
        ),
        textStyle: textos.bodySmall?.copyWith(color: c.superficie),
      ),
      dataTableTheme: DataTableThemeData(
        headingTextStyle: textos.labelSmall?.copyWith(color: c.textoSecundario),
        dataTextStyle: textos.bodyMedium,
        dividerThickness: tamano.bordeFino,
        headingRowColor: WidgetStatePropertyAll(c.fondo),
      ),
      dropdownMenuTheme: DropdownMenuThemeData(
        textStyle: textos.bodyLarge,
        menuStyle: MenuStyle(
          backgroundColor: WidgetStatePropertyAll(c.superficieElevada),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(tokens.radio.m),
            ),
          ),
        ),
      ),
    );
  }
}
