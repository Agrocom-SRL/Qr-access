import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_skeleton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:flutter/material.dart';

/// Cómo se pinta un indicador del tablero (handoff): normal, hero (fondo
/// verde, cifra en sobreHero) o alerta (cifra en peligro si es mayor que 0).
enum VarianteIndicador { normal, hero, alerta }

/// Indicador del tablero (C04b): el hero lleva rótulo y cifra a la izquierda
/// con el ícono a la derecha; los demás, el ícono arriba, el rótulo y la
/// cifra en mono 32. La nota es opcional y va debajo de la cifra.
class TarjetaIndicador extends StatelessWidget {
  const new({
    required this.etiqueta,
    required this.icono,
    this.valor,
    this.nota,
    this.variante = VarianteIndicador.normal,
    this.alTocar,
    super.key,
  });

  final String etiqueta;
  final IconData icono;

  /// `null` mientras carga: se muestra un skeleton.
  final int? valor;
  final String? nota;
  final VarianteIndicador variante;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final esHero = variante == VarianteIndicador.hero;
    final enAlerta = variante == VarianteIndicador.alerta && (valor ?? 0) > 0;
    final colorTexto = esHero ? colores.sobreHero : colores.texto;
    final colorSecundario = esHero
        ? colores.sobreHero
        : colores.textoSecundario;
    final colorCifra = enAlerta ? colores.peligro : colorTexto;

    final icono = CajaIcono(
      icono: this.icono,
      tono: esHero
          ? TonoCaja.hero
          : (variante == VarianteIndicador.alerta
                ? TonoCaja.peligro
                : TonoCaja.primario),
      tamano: esHero ? tokens.tamano.accesoRapido : null,
    );
    final rotulo = Text(
      etiqueta,
      style: textos.bodyLarge?.copyWith(color: colorSecundario),
    );
    final cifra = valor == null
        ? AccesoSkeleton(ancho: tokens.tamano.logo, alto: tokens.tipografia.t32)
        : Text(
            '$valor',
            style: tokens.tipografia.mono(
              tokens.tipografia.t32,
              peso: tokens.tipografia.semiNegrita,
              color: colorCifra,
            ),
          );
    final notaTexto = nota == null
        ? null
        : Text(
            nota!,
            style: textos.bodyMedium?.copyWith(color: colorSecundario),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          );

    return AccesoTarjeta(
      alTocar: alTocar,
      color: esHero ? colores.hero : null,
      relleno: EdgeInsets.all(tokens.espacio.xl),
      child: esHero
          ? Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      rotulo,
                      SizedBox(height: tokens.espacio.xs),
                      cifra,
                      if (notaTexto != null) ...[
                        SizedBox(height: tokens.espacio.xs),
                        notaTexto,
                      ],
                    ],
                  ),
                ),
                SizedBox(width: tokens.espacio.l),
                icono,
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                icono,
                SizedBox(height: tokens.espacio.m),
                rotulo,
                SizedBox(height: tokens.espacio.xs),
                cifra,
                if (notaTexto != null) ...[
                  SizedBox(height: tokens.espacio.xs),
                  notaTexto,
                ],
              ],
            ),
    );
  }
}
