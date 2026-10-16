import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:google_nav_bar/google_nav_bar.dart';

/// Un destino de la [BarraNavegacion].
class DestinoBarra {
  const new({
    required this.icono,
    required this.iconoActivo,
    required this.etiqueta,
  });

  final IconData icono;
  final IconData iconoActivo;
  final String etiqueta;
}

/// Barra de navegación inferior del compacto con el diseño de Google
/// (paquete `google_nav_bar`): la pestaña elegida se expande en una píldora
/// con su texto y las demás quedan solo con el ícono.
class BarraNavegacion extends StatelessWidget {
  const new({
    required this.destinos,
    required this.indice,
    required this.alElegir,
    super.key,
  });

  final List<DestinoBarra> destinos;
  final int indice;
  final ValueChanged<int> alElegir;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colores.superficie,
        border: Border(
          top: BorderSide(color: colores.borde, width: tokens.tamano.bordeFino),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: tokens.espacio.m,
            vertical: tokens.espacio.s,
          ),
          child: GNav(
            selectedIndex: indice,
            onTabChange: alElegir,
            gap: tokens.espacio.s,
            iconSize: tokens.tamano.iconoNav,
            color: colores.textoSecundario,
            activeColor: colores.primario,
            tabBackgroundColor: colores.primarioSuave,
            rippleColor: colores.primarioSuave,
            hoverColor: colores.primarioSuave,
            duration: tokens.duracion.efectiva(context, tokens.duracion.normal),
            curve: Curves.easeOutCubic,
            textStyle: textos.labelLarge?.copyWith(
              color: colores.primario,
              fontWeight: tokens.tipografia.semiNegrita,
            ),
            padding: EdgeInsets.symmetric(
              horizontal: tokens.espacio.m,
              vertical: tokens.espacio.m,
            ),
            tabs: [
              for (var i = 0; i < destinos.length; i++)
                GButton(
                  icon: i == indice
                      ? destinos[i].iconoActivo
                      : destinos[i].icono,
                  text: destinos[i].etiqueta,
                  semanticLabel: destinos[i].etiqueta,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
