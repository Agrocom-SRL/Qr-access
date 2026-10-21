import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Entrada a las estadísticas de uso (ADR 0028 §4) con lo esencial a la vista:
/// cuántos usuarios están inactivos, cuántos son ruidosos y cuántos Titulares
/// están cerca de su tope. Es informativa: si no carga, no se muestra.
class TarjetaEstadisticas extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(estadisticasProvider).value;
    if (datos == null) return const SizedBox.shrink();
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.espacio.l,
        tokens.espacio.m,
        tokens.espacio.l,
        0,
      ),
      child: AccesoTarjeta(
        alTocar: () => context.go(Rutas.adminEstadisticas),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.estadisticasTitulo, style: textos.titleMedium),
                  Text(
                    l10n.estadisticasResumen(
                      datos.inactivos.length,
                      datos.ruidosos.length,
                      datos.titularesCercaDelTope.length,
                    ),
                    style: textos.bodyMedium?.copyWith(
                      color: tokens.colores.textoSecundario,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: tokens.colores.textoSecundario,
              size: tokens.tamano.iconoNav,
            ),
          ],
        ),
      ),
    );
  }
}
