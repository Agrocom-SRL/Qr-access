import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Plantilla de QR emitido y PIN generado (handoff): sin navegación, cerrar
/// arriba a la izquierda, contenido con ancho de formulario y la acción
/// principal fija abajo.
class PlantillaPantallaCompleta extends StatelessWidget {
  const new({
    required this.titulo,
    required this.child,
    required this.alCerrar,
    this.pie,
    this.iconoCerrar = Icons.close,
    super.key,
  });

  final String titulo;
  final Widget child;

  /// Lo que pasa al tocar cerrar (la pantalla puede pedir confirmación).
  final VoidCallback alCerrar;

  /// Acción principal, fija abajo.
  final Widget? pie;
  final IconData iconoCerrar;

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
          leading: IconButton(
            tooltip: context.l10n.comunCerrar,
            onPressed: alCerrar,
            icon: Icon(iconoCerrar),
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
