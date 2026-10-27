import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/features/notificaciones/presentation/notificaciones_controlador.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Ícono de la bandeja en la cabecera del inicio, con el contador de lo que
/// aún no se leyó (ADR 0030 §6). Si no hay contador (sin red o sin datos), se
/// ve el ícono sin número: el aviso no bloquea nada.
class BotonNotificaciones extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final noLeidas = ref.watch(contadorNotificacionesProvider).value ?? 0;
    return Badge.count(
      count: noLeidas,
      isLabelVisible: noLeidas > 0,
      child: IconButton.filledTonal(
        tooltip: context.l10n.notificacionesAbrir,
        onPressed: () => context.go(Rutas.notificaciones),
        icon: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}
