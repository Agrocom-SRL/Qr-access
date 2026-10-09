import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Fila "clave · valor" (resúmenes, perfil). Variante navegable: ícono a la
/// izquierda y chevron a la derecha, o un [accion] propio (botón o
/// interruptor).
class FilaClaveValor extends StatelessWidget {
  const new({
    required this.clave,
    this.valor,
    this.valorWidget,
    this.icono,
    this.accion,
    this.alTocar,
    this.valorMono = false,
    this.valorEnAdvertencia = false,
    this.invertida = false,
    this.conSeparador = true,
    super.key,
  });

  final String clave;
  final String? valor;

  /// Reemplaza al texto del valor (p. ej. varias líneas).
  final Widget? valorWidget;
  final IconData? icono;

  /// Widget a la derecha (botón "Cambiar rol", interruptor).
  final Widget? accion;
  final VoidCallback? alTocar;
  final bool valorMono;
  final bool valorEnAdvertencia;

  /// Clave arriba en secundario y valor abajo en texto (filas de Perfil), en
  /// vez de clave a la izquierda y valor a la derecha (resumen).
  final bool invertida;
  final bool conSeparador;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final estiloValor = valorMono
        ? tokens.tipografia.mono(tokens.tipografia.t16, color: colores.texto)
        : textos.titleMedium?.copyWith(
            color: valorEnAdvertencia ? colores.advertencia : colores.texto,
          );
    final estiloClave = textos.bodyMedium?.copyWith(
      color: colores.textoSecundario,
    );
    final Widget cuerpo;
    if (invertida) {
      cuerpo = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(clave, style: estiloClave),
          SizedBox(height: tokens.espacio.xxs),
          valorWidget ?? Text(valor ?? '', style: estiloValor),
        ],
      );
    } else {
      cuerpo = Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(clave, style: estiloClave),
          SizedBox(width: tokens.espacio.l),
          Expanded(
            child: Align(
              alignment: AlignmentDirectional.centerEnd,
              child:
                  valorWidget ??
                  Text(
                    valor ?? '',
                    style: estiloValor,
                    textAlign: TextAlign.end,
                  ),
            ),
          ),
        ],
      );
    }
    final fila = Padding(
      padding: EdgeInsets.symmetric(vertical: tokens.espacio.m),
      child: Row(
        children: [
          if (icono != null) ...[
            Icon(
              icono,
              size: tokens.tamano.iconoNav,
              color: colores.textoSecundario,
            ),
            SizedBox(width: tokens.espacio.l),
          ],
          Expanded(child: cuerpo),
          if (accion != null) ...[
            SizedBox(width: tokens.espacio.m),
            accion!,
          ] else if (alTocar != null) ...[
            SizedBox(width: tokens.espacio.s),
            Icon(
              Icons.chevron_right,
              size: tokens.tamano.iconoNav,
              color: colores.textoSecundario,
            ),
          ],
        ],
      ),
    );
    final conToque = alTocar == null
        ? fila
        : InkWell(
            onTap: alTocar,
            borderRadius: BorderRadius.circular(tokens.radio.m),
            child: fila,
          );
    return Column(children: [conToque, if (conSeparador) const Divider()]);
  }
}
