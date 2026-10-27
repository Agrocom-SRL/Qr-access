import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_logo.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Bienvenida (C01, E01): hero verde con el logo y la frase, "Ingresar" y la
/// ayuda para quien no tiene PIN. En teléfono horizontal, el hero va a un lado
/// y las acciones al otro, para que nada quede desbordado por la poca altura.
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

    if (esTelefonoApaisado(context)) {
      return Scaffold(
        body: SafeArea(
          child: Row(
            children: [
              Expanded(
                flex: 3,
                child: ClipRRect(
                  borderRadius: BorderRadius.horizontal(
                    right: Radius.circular(tokens.radio.xl),
                  ),
                  child: const _Hero(),
                ),
              ),
              Expanded(flex: 2, child: _PanelAcciones(child: acciones)),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.vertical(
                bottom: Radius.circular(tokens.radio.xl),
              ),
              child: const _Hero(),
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

/// Hero verde de la bienvenida: la foto del edificio, el logo y el nombre con
/// la frase. Lo recorta quien lo usa (abajo en vertical, a la izquierda en
/// horizontal).
class _Hero extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final colores = tokens.colores;
    return ColoredBox(
      color: colores.hero,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const AccesoFoto(ruta: Multimedia.fotoBienvenida),
          SizedBox(
            width: double.infinity,
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
        ],
      ),
    );
  }
}

/// Acciones de la bienvenida en teléfono horizontal: centradas en vertical
/// dentro de su columna y con scroll si el teclado o la altura no alcanzan.
class _PanelAcciones extends StatelessWidget {
  const new({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return LayoutBuilder(
      builder: (context, restricciones) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: restricciones.maxHeight),
          child: Padding(
            padding: EdgeInsets.all(tokens.espacio.xl),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: tokens.tamano.maxAuth),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
