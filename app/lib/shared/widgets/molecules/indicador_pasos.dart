import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Cabecera del stepper (handoff C05): círculos de 32 numerados, con check en
/// los pasos hechos y una línea entre ellos.
///
/// Si los tres nombres entran enteros, cada paso mide lo suyo y las líneas
/// reparten el resto; si no, los pasos reparten el ancho en proporción a lo
/// que necesitan y el nombre que no entra se corta con puntos suspensivos.
class IndicadorPasos extends StatelessWidget {
  const new({required this.pasos, required this.actual, super.key});

  /// Nombres de los pasos, en orden.
  final List<String> pasos;

  /// Índice del paso en curso, desde 0.
  final int actual;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final estiloNombre = textos.labelMedium?.copyWith(
      fontWeight: tokens.tipografia.semiNegrita,
    );
    final escala = MediaQuery.textScalerOf(context);
    final anchoDeLinea = tokens.espacio.l + tokens.espacio.s * 2;

    return LayoutBuilder(
      builder: (context, restricciones) {
        final anchos = [
          for (final nombre in pasos)
            tokens.tamano.chipPaso +
                tokens.espacio.s +
                _anchoDeTexto(nombre, estiloNombre, escala),
        ];
        final necesario =
            anchos.fold<double>(0, (suma, a) => suma + a) +
            anchoDeLinea * (pasos.length - 1);
        final entran =
            !restricciones.hasBoundedWidth ||
            necesario <= restricciones.maxWidth;

        return Row(
          children: [
            for (var i = 0; i < pasos.length; i++) ...[
              if (i > 0)
                Expanded(
                  flex: entran ? 1 : anchoDeLinea.round(),
                  child: Container(
                    height: tokens.tamano.bordeFoco,
                    constraints: BoxConstraints(minWidth: tokens.espacio.l),
                    margin: EdgeInsets.symmetric(horizontal: tokens.espacio.s),
                    color: i <= actual ? colores.primario : colores.borde,
                  ),
                ),
              if (entran)
                _Paso(
                  numero: i + 1,
                  nombre: pasos[i],
                  hecho: i < actual,
                  activo: i == actual,
                  textos: textos,
                )
              else
                Expanded(
                  flex: anchos[i].round(),
                  child: _Paso(
                    numero: i + 1,
                    nombre: pasos[i],
                    hecho: i < actual,
                    activo: i == actual,
                    textos: textos,
                  ),
                ),
            ],
          ],
        );
      },
    );
  }

  /// Ancho que ocupa [texto] en una línea con [estilo] y la escala de texto
  /// del sistema.
  static double _anchoDeTexto(
    String texto,
    TextStyle? estilo,
    TextScaler escala,
  ) {
    final pintor = TextPainter(
      text: TextSpan(text: texto, style: estilo),
      textDirection: TextDirection.ltr,
      textScaler: escala,
      maxLines: 1,
    )..layout();
    final ancho = pintor.width;
    pintor.dispose();
    return ancho;
  }
}

class _Paso extends StatelessWidget {
  const new({
    required this.numero,
    required this.nombre,
    required this.hecho,
    required this.activo,
    required this.textos,
  });

  final int numero;
  final String nombre;
  final bool hecho;
  final bool activo;
  final TextTheme textos;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final relleno = hecho || activo;
    return Semantics(
      label: nombre,
      selected: activo,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: tokens.duracion.efectiva(context, tokens.duracion.lenta),
            width: tokens.tamano.chipPaso,
            height: tokens.tamano.chipPaso,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: relleno ? colores.primario : null,
              border: relleno ? null : Border.all(color: colores.borde),
            ),
            alignment: Alignment.center,
            child: hecho
                ? Icon(
                    Icons.check,
                    size: tokens.tamano.icono,
                    color: colores.sobrePrimario,
                  )
                : Text(
                    '$numero',
                    style: tokens.tipografia.mono(
                      tokens.tipografia.t14,
                      color: relleno
                          ? colores.sobrePrimario
                          : colores.textoSecundario,
                    ),
                  ),
          ),
          SizedBox(width: tokens.espacio.s),
          Flexible(
            child: Text(
              nombre,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: textos.labelMedium?.copyWith(
                color: activo ? colores.texto : colores.textoSecundario,
                fontWeight: activo
                    ? tokens.tipografia.semiNegrita
                    : tokens.tipografia.medio,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
