import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Variantes de botón del sistema de diseño (handoff §Átomos): primario,
/// secundario (con borde), texto, tonal (fondo suave), peligro tonal y
/// peligro relleno. Un cambio de estado lleva el tono del estado al que lleva.
enum VarianteBoton {
  primaria,
  secundaria,
  texto,
  tonal,
  peligroTonal,
  peligroRelleno,
}

/// Botón de la app. Con [cargando] muestra un spinner de 16 y el verbo en
/// gerundio ([textoCargando]) y no responde a toques, para que una acción no
/// se envíe dos veces. [expandido] lo estira a todo el ancho.
class AccesoBoton extends StatelessWidget {
  const new({
    required this.texto,
    required this.onPressed,
    this.variante = VarianteBoton.primaria,
    this.cargando = false,
    this.textoCargando,
    this.icono,
    this.expandido = false,
    super.key,
  });

  final String texto;
  final VoidCallback? onPressed;
  final VarianteBoton variante;
  final bool cargando;
  final String? textoCargando;
  final IconData? icono;
  final bool expandido;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final habilitado = !cargando && onPressed != null;
    final alPresionar = habilitado ? onPressed : null;
    final contenido = _Contenido(
      texto: texto,
      textoCargando: textoCargando,
      icono: icono,
      cargando: cargando,
    );

    final boton = switch (variante) {
      VarianteBoton.primaria => FilledButton(
        onPressed: alPresionar,
        child: contenido,
      ),
      VarianteBoton.secundaria => OutlinedButton(
        onPressed: alPresionar,
        child: contenido,
      ),
      VarianteBoton.texto => TextButton(
        onPressed: alPresionar,
        child: contenido,
      ),
      VarianteBoton.tonal => FilledButton.tonal(
        onPressed: alPresionar,
        style: FilledButton.styleFrom(
          backgroundColor: colores.primarioSuave,
          foregroundColor: colores.primario,
        ),
        child: contenido,
      ),
      VarianteBoton.peligroTonal => FilledButton.tonal(
        onPressed: alPresionar,
        style: FilledButton.styleFrom(
          backgroundColor: colores.peligroSuave,
          foregroundColor: colores.peligro,
        ),
        child: contenido,
      ),
      VarianteBoton.peligroRelleno => FilledButton(
        onPressed: alPresionar,
        style: FilledButton.styleFrom(
          backgroundColor: colores.peligro,
          foregroundColor: colores.superficie,
        ),
        child: contenido,
      ),
    };
    return expandido ? SizedBox(width: double.infinity, child: boton) : boton;
  }
}

class _Contenido extends StatelessWidget {
  const new({
    required this.texto,
    required this.textoCargando,
    required this.icono,
    required this.cargando,
  });

  final String texto;
  final String? textoCargando;
  final IconData? icono;
  final bool cargando;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (cargando) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: tokens.tamano.spinner,
            child: CircularProgressIndicator(
              strokeWidth: tokens.tamano.bordeFoco,
              semanticsLabel: context.l10n.comunCargando,
            ),
          ),
          if (textoCargando != null) ...[
            SizedBox(width: tokens.espacio.s),
            Flexible(
              child: Text(textoCargando!, overflow: TextOverflow.ellipsis),
            ),
          ],
        ],
      );
    }
    final icono = this.icono;
    if (icono == null) return Text(texto, overflow: TextOverflow.ellipsis);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icono, size: tokens.tamano.icono),
        SizedBox(width: tokens.espacio.s),
        Flexible(child: Text(texto, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}
