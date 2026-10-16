import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// Indicador de carga centrado, con su texto para lectores de pantalla.
/// Para los listados se prefiere el skeleton (`ListadoPaginado`).
class AccesoCargando extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: CircularProgressIndicator(
        semanticsLabel: context.l10n.comunCargando,
      ),
    );
  }
}
