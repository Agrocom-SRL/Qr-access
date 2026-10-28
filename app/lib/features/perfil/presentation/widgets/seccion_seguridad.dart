import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// "Seguridad y datos" (ADR 0033): incidentes de uso, anulación masiva de mi
/// rama y exportación en CSV. Cada fila sale de su permiso, y la API decide
/// sobre qué alcanza. Sin ninguno de los tres, la sección no aparece.
class SeccionSeguridad extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final verIncidentes = sesion.tiene(Permisos.verIncidentes);
    final anularDeRama = sesion.tiene(Permisos.anularQrDeRama);
    final exportar = sesion.tiene(Permisos.exportarDatos);
    if (!verIncidentes && !anularDeRama && !exportar) {
      return const SizedBox.shrink();
    }
    // Mientras se anula, la fila no responde: no se manda dos veces.
    final anulando = ref.watch(anulacionMasivaProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.perfilSeguridadTitulo,
          style: Theme.of(context).textTheme.titleSmall,
        ),
        SizedBox(height: tokens.espacio.s),
        AccesoTarjeta(
          relleno: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
          child: Column(
            children: [
              if (verIncidentes)
                FilaClaveValor(
                  clave: l10n.perfilIncidentes,
                  valor: l10n.perfilIncidentesAyuda,
                  icono: Icons.report_outlined,
                  invertida: true,
                  claveEnfatizada: true,
                  alTocar: () => context.go(Rutas.incidentes),
                ),
              if (anularDeRama)
                FilaClaveValor(
                  clave: l10n.perfilAnularMiRama,
                  valor: l10n.perfilAnularMiRamaAyuda,
                  icono: Icons.block,
                  invertida: true,
                  claveEnfatizada: true,
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
      ],
    );
  }
}
