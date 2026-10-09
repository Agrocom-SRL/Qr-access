import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:flutter/material.dart';

/// Variantes (handoff): vacío (ícono primario, acción primaria), error
/// (ícono peligro + "Reintentar") y sin conexión (cloud_off + "Reintentar").
enum VarianteEstadoVacio { vacio, error, sinConexion }

/// Pantalla de un listado sin datos, con error o sin red
/// (docs/diseno/guia-pantallas.md §2.2).
class EstadoVacio extends StatelessWidget {
  const new({
    required this.titulo,
    this.icono,
    this.ayuda,
    this.textoAccion,
    this.iconoAccion,
    this.alAccionar,
    this.variante = VarianteEstadoVacio.vacio,
    super.key,
  });

  /// Error con el texto genérico y "Reintentar".
  factory error({
    required String titulo,
    required VoidCallback alReintentar,
    Key? key,
  }) => EstadoVacio(
    titulo: titulo,
    variante: VarianteEstadoVacio.error,
    alAccionar: alReintentar,
    key: key,
  );

  /// Sin conexión, con "Reintentar".
  factory sinConexion({
    required String titulo,
    required VoidCallback alReintentar,
    Key? key,
  }) => EstadoVacio(
    titulo: titulo,
    variante: VarianteEstadoVacio.sinConexion,
    alAccionar: alReintentar,
    key: key,
  );

  final String titulo;
  final IconData? icono;
  final String? ayuda;
  final String? textoAccion;
  final IconData? iconoAccion;
  final VoidCallback? alAccionar;
  final VarianteEstadoVacio variante;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final texto = Theme.of(context).textTheme;
    final (
      iconoFinal,
      tono,
      ayudaFinal,
      accionFinal,
      iconoAccionFinal,
    ) = switch (variante) {
      VarianteEstadoVacio.vacio => (
        icono ?? Icons.inbox_outlined,
        TonoCaja.primario,
        ayuda,
        textoAccion,
        iconoAccion,
      ),
      VarianteEstadoVacio.error => (
        Icons.error_outline,
        TonoCaja.peligro,
        ayuda ?? l10n.comunErrorAyuda,
        textoAccion ?? l10n.comunReintentar,
        Icons.refresh,
      ),
      VarianteEstadoVacio.sinConexion => (
        Icons.cloud_off_outlined,
        TonoCaja.peligro,
        ayuda ?? l10n.comunSinConexionAyuda,
        textoAccion ?? l10n.comunReintentar,
        Icons.refresh,
      ),
    };
    return Center(
      child: Padding(
        padding: EdgeInsets.all(tokens.espacio.xl),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: tokens.tamano.maxAuth),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CajaIcono(
                icono: iconoFinal,
                tono: tono,
                tamano: tokens.tamano.accesoRapido,
              ),
              SizedBox(height: tokens.espacio.l),
              Text(
                titulo,
                style: texto.titleLarge,
                textAlign: TextAlign.center,
              ),
              if (ayudaFinal != null) ...[
                SizedBox(height: tokens.espacio.s),
                Text(
                  ayudaFinal,
                  style: texto.bodyMedium?.copyWith(
                    color: tokens.colores.textoSecundario,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
              if (accionFinal != null && alAccionar != null) ...[
                SizedBox(height: tokens.espacio.xl),
                AccesoBoton(
                  texto: accionFinal,
                  icono: iconoAccionFinal,
                  onPressed: alAccionar,
                  variante: variante == VarianteEstadoVacio.vacio
                      ? VarianteBoton.primaria
                      : VarianteBoton.tonal,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
