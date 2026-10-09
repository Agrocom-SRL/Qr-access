import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Rótulo + control + ayuda, contador o error (handoff §Moléculas). El error
/// tiene prioridad sobre la ayuda; el contador "16/40" va a la derecha.
class CampoFormulario extends StatelessWidget {
  const new({
    required this.etiqueta,
    required this.child,
    this.opcional = false,
    this.ayuda,
    this.textoError,
    this.largoActual,
    this.largoMaximo,
    super.key,
  });

  final String etiqueta;
  final Widget child;
  final bool opcional;
  final String? ayuda;
  final String? textoError;
  final int? largoActual;
  final int? largoMaximo;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final colores = tokens.colores;
    final pie = textoError ?? ayuda;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text.rich(
          TextSpan(
            text: etiqueta,
            style: textos.titleMedium,
            children: [
              if (opcional)
                TextSpan(
                  text: ' ${context.l10n.comunOpcional}',
                  style: textos.bodyLarge?.copyWith(
                    color: colores.textoSecundario,
                  ),
                ),
            ],
          ),
        ),
        SizedBox(height: tokens.espacio.s),
        child,
        if (pie != null || largoMaximo != null) ...[
          SizedBox(height: tokens.espacio.xs),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: pie == null
                    ? const SizedBox.shrink()
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (textoError != null) ...[
                            Icon(
                              Icons.error_outline,
                              size: tokens.tamano.icono,
                              color: colores.peligro,
                            ),
                            SizedBox(width: tokens.espacio.xs),
                          ],
                          Expanded(
                            child: Text(
                              pie,
                              style: textos.bodyMedium?.copyWith(
                                color: textoError != null
                                    ? colores.peligro
                                    : colores.textoSecundario,
                              ),
                            ),
                          ),
                        ],
                      ),
              ),
              if (largoMaximo != null) ...[
                SizedBox(width: tokens.espacio.s),
                Text(
                  '${largoActual ?? 0}/$largoMaximo',
                  style: tokens.tipografia.mono(
                    tokens.tipografia.t14,
                    color: (largoActual ?? 0) > largoMaximo!
                        ? colores.peligro
                        : colores.textoSecundario,
                  ),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}
