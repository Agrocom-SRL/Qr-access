import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Qué hace el botón de salida de una cabecera. El handoff (Estados y
/// Pantallas) usa flecha para "Atrás" y X para cerrar; la convención es
/// esta:
///
/// - [volver]: flecha. Vuelve un paso dentro de una jerarquía o de un flujo:
///   detalle → lista, subpágina de Perfil → Perfil, Ingresa PIN → Bienvenida,
///   pasos 2 y 3 de Generar QR.
/// - [cerrar]: X. Descarta lo que se estaba haciendo: formularios de crear y
///   editar, el primer paso de Generar QR, y el QR y el PIN generados (se ven
///   una sola vez y "salir" es abandonarlos).
/// - [ninguna]: sin botón. Un destino principal de la navegación no tiene
///   salida.
enum SalidaDeCabecera { volver, cerrar, ninguna }

/// Botón de salida de una cabecera, con su ícono, su tooltip (que también es su
/// semántica, desde el ARB) y la zona táctil mínima del tema. Es el único
/// lugar que pinta el botón de volver o cerrar: las plantillas y el AppBar de
/// Generar QR lo usan para no repetir el ícono ni el tamaño.
class BotonSalidaCabecera extends StatelessWidget {
  const new({
    required this.salida,
    required this.alPulsar,
    this.color,
    super.key,
  }) : assert(
         salida != SalidaDeCabecera.ninguna,
         'Una salida "ninguna" no tiene botón',
       );

  final SalidaDeCabecera salida;
  final VoidCallback alPulsar;

  /// Color del ícono; `null` toma el de la cabecera (una foto de fondo lo
  /// pide claro).
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final esVolver = salida == SalidaDeCabecera.volver;
    return IconButton(
      tooltip: esVolver ? l10n.comunVolver : l10n.comunCerrar,
      onPressed: alPulsar,
      color: color,
      // El mínimo táctil del tema (44): el ícono sigue siendo de 24, pero la
      // zona que responde al toque nunca baja de ahí.
      constraints: BoxConstraints(
        minWidth: tokens.tamano.controlMinimo,
        minHeight: tokens.tamano.controlMinimo,
      ),
      icon: Icon(esVolver ? Icons.arrow_back : Icons.close),
    );
  }
}
