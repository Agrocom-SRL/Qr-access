import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';

/// Plantilla de QR generado y PIN generado (handoff): sin navegación, cerrar
/// arriba a la izquierda, contenido con ancho de formulario y la acción
/// principal fija abajo.
///
/// Con [visual] (el QR), en teléfono horizontal el visual ocupa la mitad
/// izquierda, completo y sin desplazarse, y [child] con [pie] la mitad
/// derecha: el botón ya no tapa el QR. En vertical, [visual] va encima de
/// [child] como siempre.
class PlantillaPantallaCompleta extends StatelessWidget {
  const new({
    required this.titulo,
    required this.child,
    required this.alCerrar,
    this.pie,
    this.visual,
    super.key,
  });

  final String titulo;
  final Widget child;

  /// Lo que se mira de un vistazo (el QR). Sin él, la pantalla siempre va en
  /// una sola columna (carga y error).
  final Widget? visual;

  /// Lo que pasa al tocar cerrar (la pantalla puede pedir confirmación).
  final VoidCallback alCerrar;

  /// Acción principal, fija abajo.
  final Widget? pie;

  @override
  Widget build(BuildContext context) {
    // El visual solo se parte en columnas en teléfono horizontal; en tablet
    // y en web conserva la distribución de vertical.
    final visualLateral = esTelefonoApaisado(context) ? visual : null;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (hizoPop, _) {
        if (!hizoPop) alCerrar();
      },
      child: Scaffold(
        appBar: AppBar(
          // Siempre X: lo que muestra se ve una sola vez y salir es abandonarlo
          leading: BotonSalidaCabecera(
            salida: SalidaDeCabecera.cerrar,
            alPulsar: alCerrar,
          ),
          title: Text(titulo),
        ),
        body: SafeArea(
          child: visualLateral != null
              ? _EnColumnas(visual: visualLateral, pie: pie, child: child)
              : _EnVertical(visual: visual, pie: pie, child: child),
        ),
      ),
    );
  }
}

/// Vertical (y todo lo que no es teléfono horizontal): el visual encima del
/// contenido, con scroll, y la acción fija abajo.
class _EnVertical extends StatelessWidget {
  const new({required this.child, this.visual, this.pie});

  final Widget? visual;
  final Widget child;
  final Widget? pie;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(tokens.espacio.l),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: tokens.tamano.maxFormulario,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (visual != null) ...[
                      Center(child: visual),
                      SizedBox(height: tokens.espacio.xl),
                    ],
                    child,
                  ],
                ),
              ),
            ),
          ),
        ),
        if (pie != null)
          Padding(
            padding: EdgeInsets.all(tokens.espacio.l),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: tokens.tamano.maxAuth),
                child: pie,
              ),
            ),
          ),
      ],
    );
  }
}

/// Teléfono en horizontal: el visual (el QR) a la izquierda, a su tamaño y
/// centrado, y el contenido a la derecha con scroll y la acción abajo. El
/// visual va en un scroll propio, solo por si el alto de un teléfono
/// pequeño no alcanza; en 393 de alto cabe entero y sin desplazarse.
class _EnColumnas extends StatelessWidget {
  const new({required this.visual, required this.child, this.pie});

  final Widget visual;
  final Widget child;
  final Widget? pie;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
                child: visual,
              ),
            ),
          ),
          SizedBox(width: tokens.espacio.xl),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
                    child: child,
                  ),
                ),
                if (pie != null)
                  Padding(
                    padding: EdgeInsets.only(bottom: tokens.espacio.l),
                    child: pie,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
