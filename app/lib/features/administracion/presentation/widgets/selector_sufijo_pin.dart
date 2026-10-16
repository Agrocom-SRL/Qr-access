import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Largo del sufijo del PIN: los 4 caracteres que siguen al código de cuenta.
const largoSufijoDePin = 4;

/// Deja elegir cómo se forman los 4 últimos caracteres del PIN: al azar (lo
/// habitual) o escritos por el administrador (ADR 0018, addendum).
class SelectorSufijoPin extends StatelessWidget {
  const new({
    required this.elegir,
    required this.sufijo,
    required this.alElegir,
    required this.alCambiar,
    this.conError = false,
    super.key,
  });

  final bool elegir;
  final String sufijo;
  final bool conError;
  final ValueChanged<bool> alElegir;
  final ValueChanged<String> alCambiar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SwitchListTile(
          value: elegir,
          onChanged: alElegir,
          title: Text(l10n.usuariosPinManual),
          contentPadding: EdgeInsets.zero,
        ),
        if (elegir)
          CampoFormulario(
            etiqueta: l10n.usuariosPinSufijoCampo,
            ayuda: l10n.usuariosPinSufijoAyuda,
            textoError: conError ? l10n.usuariosPinSufijoError : null,
            child: AccesoCampoTexto(
              maxLargo: largoSufijoDePin,
              formateadores: [
                FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]')),
                TextInputFormatter.withFunction(
                  (anterior, nuevo) =>
                      nuevo.copyWith(text: nuevo.text.toUpperCase()),
                ),
              ],
              alCambiar: alCambiar,
            ),
          )
        else
          Text(
            l10n.usuariosPinAzar,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: tokens.colores.textoSecundario),
          ),
      ],
    );
  }
}
