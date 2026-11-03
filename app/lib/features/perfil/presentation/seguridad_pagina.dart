import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// "Seguridad y datos" (ADR 0033): anulación masiva de mi rama y exportación en
/// CSV. Cada fila sale de su permiso y la API decide sobre qué alcanza. Los
/// incidentes tienen su propia opción en el menú de Perfil.
class SeguridadPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final anularDeRama = sesion.tiene(Permisos.anularQrDeRama);
    final exportar = sesion.tiene(Permisos.exportarDatos);
    // Mientras se anula, la fila no responde: no se manda dos veces.
    final anulando = ref.watch(anulacionMasivaProvider);
    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.perfilSeguridadTitulo,
      subtitulo: l10n.perfilSeguridadAyuda,
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
              if (anularDeRama)
                FilaClaveValor(
                  clave: l10n.perfilAnularMiRama,
                  valor: l10n.perfilAnularMiRamaAyuda,
                  icono: Icons.block,
                  invertida: true,
                  claveEnfatizada: true,
                  conSeparador: exportar,
                  alTocar: anulando
                      ? null
                      : () => context.go(Rutas.anularQrDeRama),
                ),
              if (exportar)
                FilaClaveValor(
                  clave: l10n.perfilExportar,
                  valor: l10n.perfilExportarAyuda,
                  icono: Icons.file_download_outlined,
                  invertida: true,
                  claveEnfatizada: true,
                  conSeparador: false,
                  alTocar: () => context.go(Rutas.exportar),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
