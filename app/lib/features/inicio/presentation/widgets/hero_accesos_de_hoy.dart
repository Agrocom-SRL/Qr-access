import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/hero_con_foto.dart';
import 'package:flutter/material.dart';

/// Card "hero" con la foto de fondo del inicio: los accesos de hoy,
/// permitidos y rechazados. Lo comparten el guardia y el administrador (el
/// usuario común ve el de "Emitir QR", con el mismo diseño).
class HeroAccesosDeHoy extends StatelessWidget {
  const new({
    required this.permitidos,
    required this.rechazados,
    this.alTocar,
    super.key,
  });

  /// `null` mientras carga: se muestra un guion.
  final int? permitidos;
  final int? rechazados;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final contenido = HeroConFoto(
      ruta: Multimedia.fotoMuro,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.inicioAccesosDeHoy,
                  style: textos.headlineLarge?.copyWith(
                    color: colores.sobreHero,
                  ),
                ),
                SizedBox(height: tokens.espacio.l),
                Row(
                  children: [
                    Expanded(
                      child: _Cifra(
                        valor: permitidos,
                        etiqueta: l10n.eventosFiltroPermitidos,
                      ),
                    ),
                    Expanded(
                      child: _Cifra(
                        valor: rechazados,
                        etiqueta: l10n.inicioRechazados,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(width: tokens.espacio.l),
          CajaIcono(
            icono: Icons.login,
            tono: TonoCaja.hero,
            tamano: tokens.tamano.accesoRapido,
          ),
        ],
      ),
    );
    if (alTocar == null) return contenido;
    return Semantics(
      button: true,
      label: l10n.inicioAccesosDeHoy,
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(tokens.radio.xl),
        child: contenido,
      ),
    );
  }
}

class _Cifra extends StatelessWidget {
  const new({required this.valor, required this.etiqueta});

  final int? valor;
  final String etiqueta;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final color = tokens.colores.sobreHero;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          valor?.toString() ?? context.l10n.comunGuion,
          style: tokens.tipografia.mono(tokens.tipografia.t32, color: color),
        ),
        Text(etiqueta, style: textos.bodyLarge?.copyWith(color: color)),
      ],
    );
  }
}
