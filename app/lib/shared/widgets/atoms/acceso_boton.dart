import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Variantes de botón. Los tonos de acción son fijos (sistema de diseño §4):
/// Ver = [informacion], Editar = [advertencia], Eliminar = [peligro]; un
/// cambio de estado lleva el tono del estado al que lleva.
enum VarianteBoton {
  primaria,
  secundaria,
  texto,
  informacion,
  advertencia,
  peligro,
}

/// Botón de la app. Con [cargando] muestra un indicador en lugar del texto y
/// no responde a toques, para que una acción no se envíe dos veces.
class AccesoBoton extends StatelessWidget {
  const new({
    required this.texto,
    required this.onPressed,
    this.variante = VarianteBoton.primaria,
    this.cargando = false,
    this.icono,
    super.key,
  });

  final String texto;
  final VoidCallback? onPressed;
  final VarianteBoton variante;
  final bool cargando;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final habilitado = !cargando && onPressed != null;
    final contenido = _Contenido(
      texto: texto,
      icono: icono,
      cargando: cargando,
    );
    final alPresionar = habilitado ? onPressed : null;

    return switch (variante) {
      VarianteBoton.primaria => FilledButton(
        onPressed: alPresionar,
        child: contenido,
      ),
      VarianteBoton.secundaria => OutlinedButton(
        onPressed: alPresionar,
        style: OutlinedButton.styleFrom(
          minimumSize: Size.fromHeight(tokens.tamano.controlMinimo),
        ),
        child: contenido,
      ),
      VarianteBoton.texto => TextButton(
        onPressed: alPresionar,
        child: contenido,
      ),
      VarianteBoton.informacion => _conTono(
        alPresionar,
        contenido,
        tokens.colores.informacion,
        tokens,
      ),
      VarianteBoton.advertencia => _conTono(
        alPresionar,
        contenido,
        tokens.colores.advertencia,
        tokens,
      ),
      VarianteBoton.peligro => _conTono(
        alPresionar,
        contenido,
        tokens.colores.peligro,
        tokens,
      ),
    };
  }

  Widget _conTono(
    VoidCallback? alPresionar,
    Widget contenido,
    Color color,
    AccesoTokens tokens,
  ) {
    return FilledButton(
      onPressed: alPresionar,
      style: FilledButton.styleFrom(
        backgroundColor: color,
        foregroundColor: tokens.colores.sobrePrimario,
        minimumSize: Size.fromHeight(tokens.tamano.controlMinimo),
      ),
      child: contenido,
    );
  }
}

class _Contenido extends StatelessWidget {
  const new({required this.texto, required this.icono, required this.cargando});

  final String texto;
  final IconData? icono;
  final bool cargando;

  @override
  Widget build(BuildContext context) {
    if (cargando) {
      return SizedBox.square(
        dimension: context.tokens.tamano.icono,
        child: CircularProgressIndicator(
          semanticsLabel: context.l10n.comunCargando,
        ),
      );
    }
    final icono = this.icono;
    if (icono == null) return Text(texto);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icono, size: context.tokens.tamano.icono),
        SizedBox(width: context.tokens.espacio.s),
        Text(texto),
      ],
    );
  }
}
