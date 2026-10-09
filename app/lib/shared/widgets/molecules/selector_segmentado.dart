import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Una pastilla del selector, con su conteo opcional ("Vigentes 3").
class SegmentoDeSelector<T> {
  const new({required this.valor, required this.etiqueta, this.conteo});

  final T valor;
  final String etiqueta;
  final int? conteo;
}

/// Filtro de pastillas de 40 dp dentro de una píldora blanca (handoff: Mis QR,
/// Eventos, Administración). La elegida se rellena en primario.
class SelectorSegmentado<T> extends StatelessWidget {
  const new({
    required this.segmentos,
    required this.seleccionado,
    required this.alElegir,
    this.estirado = true,
    super.key,
  });

  final List<SegmentoDeSelector<T>> segmentos;
  final T seleccionado;
  final ValueChanged<T> alElegir;

  /// Reparte el ancho entre las pastillas (compacto) o las deja a su medida.
  final bool estirado;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    return Container(
      padding: EdgeInsets.all(tokens.espacio.xs),
      decoration: BoxDecoration(
        color: colores.superficie,
        borderRadius: BorderRadius.circular(tokens.radio.completo),
        boxShadow: colores.elev1,
      ),
      child: Row(
        mainAxisSize: estirado ? MainAxisSize.max : MainAxisSize.min,
        children: [
          for (final segmento in segmentos)
            _Pastilla(
              segmento: segmento,
              elegida: segmento.valor == seleccionado,
              estirada: estirado,
              onTap: () => alElegir(segmento.valor),
              textos: textos,
            ),
        ],
      ),
    );
  }
}

class _Pastilla<T> extends StatelessWidget {
  const new({
    required this.segmento,
    required this.elegida,
    required this.estirada,
    required this.onTap,
    required this.textos,
  });

  final SegmentoDeSelector<T> segmento;
  final bool elegida;
  final bool estirada;
  final VoidCallback onTap;
  final TextTheme textos;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final color = elegida ? colores.sobrePrimario : colores.textoSecundario;
    final pastilla = Semantics(
      button: true,
      selected: elegida,
      label: segmento.etiqueta,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(tokens.radio.completo),
        child: AnimatedContainer(
          duration: tokens.duracion.efectiva(context, tokens.duracion.normal),
          curve: tokens.duracion.curva,
          height: tokens.tamano.pastillaFiltro,
          // Repartidas a lo ancho, el relleno es el mínimo para que cuatro
          // pastillas ("Vigentes · Usados · Vencidos · Anulados") entren
          // enteras en 360 dp (C07).
          padding: EdgeInsets.symmetric(
            horizontal: estirada ? tokens.espacio.s : tokens.espacio.l,
          ),
          decoration: BoxDecoration(
            color: elegida ? colores.primario : null,
            borderRadius: BorderRadius.circular(tokens.radio.completo),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  segmento.etiqueta,
                  overflow: TextOverflow.ellipsis,
                  style: textos.labelMedium?.copyWith(
                    color: color,
                    fontWeight: elegida
                        ? tokens.tipografia.semiNegrita
                        : tokens.tipografia.medio,
                  ),
                ),
              ),
              if (segmento.conteo != null) ...[
                SizedBox(width: tokens.espacio.s),
                Text(
                  '${segmento.conteo}',
                  style: tokens.tipografia.mono(
                    tokens.tipografia.t12,
                    color: color,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
    return estirada ? Expanded(child: pastilla) : pastilla;
  }
}
