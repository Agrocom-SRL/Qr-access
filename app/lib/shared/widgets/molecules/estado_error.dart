import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Error de carga de un listado o de una pantalla, con el texto ya traducido
/// y la acción de volver a intentar.
class EstadoError extends StatelessWidget {
  const new({required this.mensaje, required this.alReintentar, super.key});

  final String mensaje;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Center(
      child: Padding(
        padding: EdgeInsets.all(tokens.espacio.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              mensaje,
              style: Theme.of(context).textTheme.bodyLarge
                  ?.copyWith(color: tokens.colores.peligro),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: tokens.espacio.l),
            AccesoBoton(
              texto: context.l10n.comunReintentar,
              variante: VarianteBoton.secundaria,
              onPressed: alReintentar,
            ),
          ],
        ),
      ),
    );
  }
}
