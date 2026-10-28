import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:flutter/material.dart';

/// Estado de las puertas: la cabecera dice cuántas están sin conexión y debajo
/// va cada puerta con su sitio y si su lector reporta, las caídas primero.
/// Muestra las primeras 3; para ver todas, "Ver puertas".
class EstadoDePuertas extends StatelessWidget {
  const new({required this.puertas, required this.alVerPuertas, super.key});

  /// Las que se muestran; el resto está en Administración › Puertas.
  static const _maximo = 3;

  final List<Puerta> puertas;

  /// `null` si el rol no supervisa puertas: no se ofrece el enlace.
  final VoidCallback? alVerPuertas;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final ordenadas = [...puertas]
      ..sort((a, b) {
        if (a.sinConexion == b.sinConexion) return 0;
        return a.sinConexion ? -1 : 1;
      });
    final caidas = ordenadas.where((p) => p.sinConexion).length;
    return AccesoTarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CajaIcono(
                icono: caidas > 0 ? Icons.wifi_off : Icons.wifi,
                tono: caidas > 0 ? TonoCaja.peligro : TonoCaja.primario,
                tamano: tokens.tamano.iconoCaja,
              ),
              SizedBox(width: tokens.espacio.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.inicioPuertasSinConexion,
                      style: textos.bodyMedium?.copyWith(
                        color: tokens.colores.textoSecundario,
                      ),
                    ),
                    Text(
                      '$caidas',
                      style: textos.headlineSmall?.copyWith(
                        color: caidas > 0
                            ? tokens.colores.peligro
                            : tokens.colores.texto,
                      ),
                    ),
                  ],
                ),
              ),
              if (alVerPuertas != null)
                AccesoBoton(
                  texto: l10n.inicioVerPuertas,
                  variante: VarianteBoton.texto,
                  onPressed: alVerPuertas,
                ),
            ],
          ),
          if (ordenadas.isNotEmpty) ...[
            SizedBox(height: tokens.espacio.s),
            const Divider(),
            for (final puerta in ordenadas.take(_maximo))
              _FilaDePuerta(puerta: puerta),
          ],
        ],
      ),
    );
  }
}

/// Una puerta del estado: nombre, sitio y su badge de conexión.
class _FilaDePuerta extends StatelessWidget {
  const new({required this.puerta});

  final Puerta puerta;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: tokens.espacio.s),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(puerta.nombre, style: textos.titleSmall),
                Text(
                  puerta.sitioNombre,
                  style: textos.bodySmall?.copyWith(
                    color: tokens.colores.textoSecundario,
                  ),
                ),
              ],
            ),
          ),
          AccesoBadge(
            texto: puerta.sinConexion
                ? l10n.puertaSinConexion
                : l10n.puertaEnLinea,
            tono: puerta.sinConexion ? TonoAcceso.peligro : TonoAcceso.primario,
          ),
        ],
      ),
    );
  }
}
