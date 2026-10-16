import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Círculo con las iniciales de una etiqueta (perfil, usuarios, saludo).
class AccesoAvatar extends StatelessWidget {
  const new({
    required this.etiqueta,
    this.tamano,
    this.neutro = false,
    super.key,
  });

  /// Texto del que salen las iniciales; vacío muestra el ícono de persona.
  final String? etiqueta;
  final double? tamano;

  /// Gris en vez de verde (listado de usuarios).
  final bool neutro;

  /// El primer nombre de la etiqueta, para el saludo: "Jorge Rivero" → "Jorge".
  static String primerNombre(String etiqueta) {
    final limpio = etiqueta.trim();
    final espacio = limpio.indexOf(' ');
    return espacio < 0 ? limpio : limpio.substring(0, espacio);
  }

  /// Dos iniciales en mayúsculas: "Carla Méndez" → "CM", "Compras" → "CO".
  static String iniciales(String? etiqueta) {
    final palabras = (etiqueta ?? '')
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (palabras.isEmpty) return '';
    if (palabras.length == 1) {
      final sola = palabras.first;
      return sola.substring(0, sola.length >= 2 ? 2 : 1).toUpperCase();
    }
    return (palabras.first[0] + palabras[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final lado = tamano ?? tokens.tamano.avatar;
    final texto = iniciales(etiqueta);
    final (fondo, color) = neutro
        ? (colores.fondo, colores.textoSecundario)
        : (colores.primarioSuave, colores.primario);
    return ExcludeSemantics(
      child: Container(
        width: lado,
        height: lado,
        decoration: BoxDecoration(color: fondo, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: texto.isEmpty
            ? Icon(Icons.person_outline, color: color, size: lado / 2)
            : Text(
                texto,
                style: Theme.of(context).textTheme.titleMedium
                    ?.copyWith(color: color, fontSize: lado / 2.6),
              ),
      ),
    );
  }
}
