import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Campo de texto de la app (handoff: alto 48, radio 10, foco primario 2,
/// error peligro 2 con ícono, carga con spinner). El rótulo va fuera, en
/// `CampoFormulario`; acá solo el campo con su placeholder.
class AccesoCampoTexto extends StatelessWidget {
  const new({
    this.controlador,
    this.placeholder,
    this.textoError,
    this.formateadores = const [],
    this.teclado,
    this.ocultar = false,
    this.habilitado = true,
    this.cargando = false,
    this.maxLargo,
    this.iconoInicial,
    this.accionTeclado = TextInputAction.done,
    this.alCambiar,
    this.alEnviar,
    this.autofoco = false,
    super.key,
  });

  final TextEditingController? controlador;
  final String? placeholder;

  /// Mensaje de error, ya traducido; pinta el borde de peligro.
  final String? textoError;
  final List<TextInputFormatter> formateadores;
  final TextInputType? teclado;
  final bool ocultar;
  final bool habilitado;

  /// Validando: spinner a la derecha y campo bloqueado.
  final bool cargando;
  final int? maxLargo;
  final IconData? iconoInicial;
  final TextInputAction accionTeclado;
  final ValueChanged<String>? alCambiar;
  final ValueChanged<String>? alEnviar;
  final bool autofoco;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return TextField(
      controller: controlador,
      enabled: habilitado && !cargando,
      obscureText: ocultar,
      autocorrect: false,
      autofocus: autofoco,
      enableSuggestions: !ocultar,
      keyboardType: teclado,
      inputFormatters: formateadores,
      textInputAction: accionTeclado,
      maxLength: maxLargo,
      onChanged: alCambiar,
      onSubmitted: alEnviar,
      style: Theme.of(context).textTheme.bodyLarge,
      decoration: InputDecoration(
        hintText: placeholder,
        errorText: textoError,
        // El contador lo pinta CampoFormulario junto a la ayuda.
        counterText: '',
        prefixIcon: iconoInicial == null
            ? null
            : Icon(iconoInicial, size: tokens.tamano.icono),
        suffixIcon: cargando
            ? Padding(
                padding: EdgeInsets.all(tokens.espacio.m),
                child: SizedBox.square(
                  dimension: tokens.tamano.spinner,
                  child: CircularProgressIndicator(
                    strokeWidth: tokens.tamano.bordeFoco,
                    semanticsLabel: context.l10n.comunCargando,
                  ),
                ),
              )
            : (textoError == null
                  ? null
                  : Icon(
                      Icons.error_outline,
                      color: tokens.colores.peligro,
                      size: tokens.tamano.icono,
                    )),
        suffixIconConstraints: BoxConstraints(
          minWidth: tokens.tamano.controlMinimo,
          minHeight: tokens.tamano.controlMinimo,
        ),
      ),
    );
  }
}
