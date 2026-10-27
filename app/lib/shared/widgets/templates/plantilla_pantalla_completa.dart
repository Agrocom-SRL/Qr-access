import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:flutter/material.dart';

/// Plantilla de QR generado y PIN generado (handoff): sin navegación, cerrar
/// arriba a la izquierda, contenido con ancho de formulario y la acción
/// principal fija abajo.
class PlantillaPantallaCompleta extends StatelessWidget {
  const new({
    required this.titulo,
    required this.child,
    required this.alCerrar,
    this.pie,
    super.key,
  });

  final String titulo;
  final Widget child;

  /// Lo que pasa al tocar cerrar (la pantalla puede pedir confirmación).
  final VoidCallback alCerrar;

  /// Acción principal, fija abajo.
  final Widget? pie;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
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
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.all(tokens.espacio.l),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: tokens.tamano.maxFormulario,
                      ),
                      child: child,
                    ),
                  ),
                ),
              ),
              if (pie != null)
                Padding(
                  padding: EdgeInsets.all(tokens.espacio.l),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: tokens.tamano.maxAuth,
                      ),
                      child: pie,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
