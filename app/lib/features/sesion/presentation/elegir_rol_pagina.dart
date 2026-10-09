import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/sesion/presentation/elegir_rol_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Elegir el rol activo cuando el usuario tiene varios (ADR 0004). Solo se
/// muestra con una sesión en `SesionEligiendoRol`.
class ElegirRolPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionControladorProvider);
    if (sesion is! SesionEligiendoRol) return const AccesoCargando();

    final estado = ref.watch(elegirRolControladorProvider);
    final controlador = ref.read(elegirRolControladorProvider.notifier);
    final l10n = context.l10n;
    final tokens = context.tokens;
    final errorApi = estado.errorApi;

    return PlantillaAuth(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.sesionElegirRolTitulo,
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          SizedBox(height: tokens.espacio.s),
          Text(
            l10n.sesionElegirRolAyuda,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: tokens.colores.textoSecundario),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: tokens.espacio.xl),
          for (final rol in sesion.roles) ...[
            AccesoBoton(
              texto: rol.nombre,
              variante: VarianteBoton.secundaria,
              cargando: estado.enviando,
              onPressed: estado.enviando
                  ? null
                  : () => controlador.elegir(rol.id),
            ),
            SizedBox(height: tokens.espacio.s),
          ],
          if (errorApi != null) ...[
            SizedBox(height: tokens.espacio.s),
            Text(
              textoDeError(l10n, errorApi),
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: tokens.colores.peligro),
              textAlign: TextAlign.center,
            ),
          ],
          SizedBox(height: tokens.espacio.l),
          AccesoBoton(
            texto: l10n.sesionCerrar,
            variante: VarianteBoton.texto,
            onPressed: controlador.cerrar,
          ),
        ],
      ),
    );
  }
}
