import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';

/// Pantalla mientras se restaura la sesión guardada al abrir la app.
class ArranquePagina extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: SafeArea(child: AccesoCargando()));
  }
}

/// Ruta que no existe en la app.
class RutaNoEncontrada extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return PlantillaAuth(
      child: EstadoVacio(
        icono: Icons.link_off,
        titulo: l10n.comunRutaNoEncontrada,
      ),
    );
  }
}
