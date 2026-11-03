import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tema_controlador.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/acerca_de_la_app.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/selector_idioma.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_interruptor.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Ajustes de la app, iguales para todos los roles: idioma, tema, dispositivos
/// conectados y acerca de la app. Se abre desde el menú de tres puntos de
/// Perfil.
class AjustesPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final oscuro = switch (ref.watch(temaProvider)) {
      ThemeMode.dark => true,
      ThemeMode.light => false,
      ThemeMode.system =>
        MediaQuery.platformBrightnessOf(context) == Brightness.dark,
    };
    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.perfilAjustes,
      anchoMaximo: tokens.tamano.maxFormulario,
      rutaAtras: Rutas.perfil,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.perfil),
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
        child: AccesoTarjeta(
          relleno: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
          child: Column(
            children: [
              const FilaIdioma(),
              FilaClaveValor(
                clave: l10n.perfilTemaOscuro,
                valor: l10n.perfilTemaOscuroAyuda,
                icono: Icons.dark_mode_outlined,
                invertida: true,
                claveEnfatizada: true,
                accion: AccesoInterruptor(
                  activo: oscuro,
                  etiqueta: l10n.perfilTemaOscuro,
                  alCambiar: (valor) => ref
                      .read(temaProvider.notifier)
                      .activarOscuro(oscuro: valor),
                ),
              ),
              FilaClaveValor(
                clave: l10n.perfilDispositivos,
                valor: l10n.perfilDispositivosAyuda,
                icono: Icons.devices_outlined,
                invertida: true,
                claveEnfatizada: true,
                alTocar: () => context.go(Rutas.dispositivos),
              ),
              const FilaAcercaDeLaApp(conSeparador: false),
            ],
          ),
        ),
      ),
    );
  }
}
