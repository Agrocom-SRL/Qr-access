import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/inicio_admin.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/inicio_usuario.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Inicio (handoff C04): el tablero de administración para quien supervisa
/// puertas y ve todos los eventos; el inicio de usuario para el resto
/// (ADR 0004: lo que el rol activo no puede, no se muestra).
class InicioPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionControladorProvider);
    if (sesion is! SesionAutenticada) return const AccesoCargando();
    return PlantillaAdmin(
      destino: DestinoNav.inicio,
      child: veTableroDeAdministracion(sesion)
          ? InicioAdmin(sesion: sesion)
          : InicioUsuario(sesion: sesion),
    );
  }
}
