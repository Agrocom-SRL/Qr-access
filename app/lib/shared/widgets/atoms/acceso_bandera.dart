import 'package:agrocom_acceso/core/l10n/idioma.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:country_flags/country_flags.dart';
import 'package:flutter/material.dart';

/// Bandera circular de un idioma (paquete `country_flags`, SVG): se ve igual
/// en Android, iOS y web, sin depender de que el sistema tenga emojis de
/// banderas (Windows no los dibuja).
class AccesoBandera extends StatelessWidget {
  const new({required this.idioma, this.tamano, super.key});

  final Idioma idioma;

  /// Diámetro; por defecto, el token de bandera.
  final double? tamano;

  @override
  Widget build(BuildContext context) {
    final lado = tamano ?? context.tokens.tamano.bandera;
    return ExcludeSemantics(
      child: CountryFlag.fromCountryCode(
        idioma.pais,
        theme: ImageTheme(width: lado, height: lado, shape: const Circle()),
      ),
    );
  }
}
