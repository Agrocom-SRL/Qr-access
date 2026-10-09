import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_logo.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Bienvenida (C01, E01): hero verde con el logo y la frase, "Ingresar" y la
/// ayuda para quien no tiene PIN.
class BienvenidaPagina extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final colores = tokens.colores;
    final acciones = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AccesoBoton(
          texto: l10n.sesionBotonIngresar,
          expandido: true,
          onPressed: () => context.go(Rutas.ingreso),
        ),
        SizedBox(height: tokens.espacio.l),
        Text(
          l10n.bienvenidaSinPin,
          style: textos.bodyMedium?.copyWith(color: colores.textoSecundario),
          textAlign: TextAlign.center,
        ),
      ],
    );

    if (context.esExpandida) {
      return PlantillaAuth(
        centrado: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.bienvenidaTitulo, style: textos.headlineMedium),
            SizedBox(height: tokens.espacio.s),
            Text(
              l10n.bienvenidaAyuda,
              style: textos.bodyLarge?.copyWith(color: colores.textoSecundario),
            ),
            SizedBox(height: tokens.espacio.xl),
            acciones,
          ],
        ),
      );
    }

    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: colores.hero,
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(tokens.radio.xl),
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: EdgeInsets.all(tokens.espacio.xl),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      const AccesoLogo(sobreHero: true),
                      SizedBox(height: tokens.espacio.xl),
                      // El nombre va en dos líneas en cualquier ancho (C01).
                      Text(
                        l10n.bienvenidaNombreApp,
                        style: textos.headlineLarge?.copyWith(
                          color: colores.sobreHero,
                        ),
                      ),
                      SizedBox(height: tokens.espacio.s),
                      Text(
                        l10n.bienvenidaFrase,
                        style: textos.bodyLarge?.copyWith(
                          color: colores.sobreHero,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.all(tokens.espacio.xl),
              child: acciones,
            ),
          ),
        ],
      ),
    );
  }
}
