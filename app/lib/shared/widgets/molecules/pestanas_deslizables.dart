import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:flutter/material.dart';

/// Pestañas en píldora con páginas que siguen al dedo: al deslizar de lado la
/// página acompaña el gesto y el indicador se desplaza con ella (`TabBar` y
/// `TabBarView`), en lugar de saltar al soltar. Tocar una pestaña anima el
/// cambio.
///
/// La pestaña elegida vive en quien lo usa ([seleccionado] y [alElegir]), para
/// que pueda guardarla donde quiera (un proveedor, el estado de la pantalla).
class PestanasDeslizables<T> extends StatefulWidget {
  const new({
    required this.segmentos,
    required this.seleccionado,
    required this.alElegir,
    required this.paginaDe,
    this.estirado = true,
    super.key,
  });

  final List<SegmentoDeSelector<T>> segmentos;
  final T seleccionado;
  final ValueChanged<T> alElegir;

  /// El contenido de cada pestaña; se construye según se necesita.
  final Widget Function(BuildContext context, T valor) paginaDe;

  /// Reparte el ancho entre las pestañas (compacto) o las deja a su medida.
  final bool estirado;

  @override
  State<PestanasDeslizables<T>> createState() =>
      _PestanasDeslizablesEstado<T>();
}

class _PestanasDeslizablesEstado<T> extends State<PestanasDeslizables<T>>
    with SingleTickerProviderStateMixin {
  late final TabController _controlador;

  int get _indiceElegido => widget.segmentos.indexWhere(
    (segmento) => segmento.valor == widget.seleccionado,
  );

  @override
  void initState() {
    super.initState();
    _controlador = TabController(
      length: widget.segmentos.length,
      vsync: this,
      initialIndex: _indiceElegido < 0 ? 0 : _indiceElegido,
    )..addListener(_alCambiar);
  }

  /// Avisa cuando el cambio terminó (no mientras el dedo arrastra).
  void _alCambiar() {
    if (_controlador.indexIsChanging) return;
    final elegido = widget.segmentos[_controlador.index].valor;
    if (elegido != widget.seleccionado) widget.alElegir(elegido);
  }

  @override
  void didUpdateWidget(PestanasDeslizables<T> anterior) {
    super.didUpdateWidget(anterior);
    final indice = _indiceElegido;
    if (indice >= 0 && indice != _controlador.index) {
      _controlador.animateTo(indice);
    }
  }

  @override
  void dispose() {
    _controlador.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final barra = DecoratedBox(
      decoration: BoxDecoration(
        color: colores.superficie,
        borderRadius: BorderRadius.circular(tokens.radio.completo),
        boxShadow: colores.elev1,
      ),
      child: Padding(
        padding: EdgeInsets.all(tokens.espacio.xs),
        child: TabBar(
          controller: _controlador,
          isScrollable: !widget.estirado,
          tabAlignment: widget.estirado ? null : TabAlignment.start,
          dividerColor: colores.superficie.withValues(alpha: 0),
          indicatorSize: TabBarIndicatorSize.tab,
          indicator: BoxDecoration(
            color: colores.primario,
            borderRadius: BorderRadius.circular(tokens.radio.completo),
          ),
          splashBorderRadius: BorderRadius.circular(tokens.radio.completo),
          labelColor: colores.sobrePrimario,
          unselectedLabelColor: colores.textoSecundario,
          labelStyle: textos.labelMedium?.copyWith(
            fontWeight: tokens.tipografia.semiNegrita,
          ),
          unselectedLabelStyle: textos.labelMedium?.copyWith(
            fontWeight: tokens.tipografia.medio,
          ),
          labelPadding: EdgeInsets.symmetric(
            horizontal: widget.estirado ? tokens.espacio.xs : tokens.espacio.l,
          ),
          tabs: [
            for (final segmento in widget.segmentos)
              Tab(
                height: tokens.tamano.pastillaFiltro,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        segmento.etiqueta,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (segmento.conteo != null) ...[
                      SizedBox(width: tokens.espacio.s),
                      Text(
                        '${segmento.conteo}',
                        style: tokens.tipografia.mono(tokens.tipografia.t12),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(
            tokens.espacio.l,
            tokens.espacio.l,
            tokens.espacio.l,
            0,
          ),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: barra,
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _controlador,
            children: [
              for (final segmento in widget.segmentos)
                widget.paginaDe(context, segmento.valor),
            ],
          ),
        ),
      ],
    );
  }
}
