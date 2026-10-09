import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/pin_generado_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla_completa.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// PIN generado a pantalla completa (handoff C10c). Llega por `extra`: al
/// cerrar no se puede volver a ver (ADR 0018 §3).
class PinGeneradoPagina extends StatelessWidget {
  const new({required this.pin, super.key});

  final PinGenerado pin;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    void cerrar() => context.go(Rutas.adminUsuarios);
    return PlantillaPantallaCompleta(
      titulo: l10n.usuariosPinGeneradoTitulo,
      alCerrar: cerrar,
      pie: AccesoBoton(
        texto: l10n.usuariosPinListo,
        expandido: true,
        onPressed: cerrar,
      ),
      child: ContenidoPinGenerado(pin: pin),
    );
  }
}
