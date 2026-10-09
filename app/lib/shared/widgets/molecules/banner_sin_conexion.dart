import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Franja "Sin conexión. Datos de las HH:mm." con "Reintentar", sobre los
/// datos en caché de un listado (handoff §Estados).
class BannerSinConexion extends StatelessWidget {
  const new({
    required this.horaDeLosDatos,
    required this.alReintentar,
    super.key,
  });

  /// Hora local ya formateada de la última carga buena.
  final String horaDeLosDatos;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: tokens.espacio.l,
        vertical: tokens.espacio.s,
      ),
      decoration: BoxDecoration(
        color: colores.peligroSuave,
        borderRadius: BorderRadius.circular(tokens.radio.m),
      ),
      child: Row(
        children: [
          Icon(
            Icons.cloud_off_outlined,
            color: colores.peligro,
            size: tokens.tamano.icono,
          ),
          SizedBox(width: tokens.espacio.s),
          Expanded(
            child: Text(
              context.l10n.comunSinConexionDatosDe(horaDeLosDatos),
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: colores.peligro),
            ),
          ),
          AccesoBoton(
            texto: context.l10n.comunReintentar,
            variante: VarianteBoton.texto,
            onPressed: alReintentar,
          ),
        ],
      ),
    );
  }
}
