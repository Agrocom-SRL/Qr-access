import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/inicio_admin.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/inicio_usuario.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Inicio (handoff C04): el tablero de administración para quien supervisa
/// puertas y ve todos los eventos; el inicio de usuario para el resto
/// (ADR 0004: lo que el rol activo no puede, no se muestra).
class InicioPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionControladorProvider);
    if (sesion is! SesionAutenticada) return const AccesoCargando();
    final esAdmin = veTableroDeAdministracion(sesion);
    return PlantillaAdmin(
      destino: DestinoNav.inicio,
      // El botón flotante, sin texto, es solo el QR propio de acceso de quien
      // emite (todos los roles con permiso); emitir para otros va en la lista.
      fab: !sesion.tiene(Permisos.emitirQr)
          ? null
          : FloatingActionButton(
              tooltip: context.l10n.inicioQrPropio,
              onPressed: () => context.go(Rutas.qrRapido),
              child: const Icon(Icons.person_pin_outlined),
            ),
      child: esAdmin
          ? InicioAdmin(sesion: sesion)
          : InicioUsuario(sesion: sesion),
    );
  }
}
