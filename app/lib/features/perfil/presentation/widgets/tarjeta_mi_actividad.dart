import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_skeleton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Cuántos QR vigentes tiene la persona hoy: solo lectura, con la fecha, y
/// lleva a Mis QR. Sin permiso de ver QR (el Guardia) no aparece.
final FutureProvider<int> _qrVigentesDeHoy = FutureProvider.autoDispose<int>((
  ref,
) async {
  final pagina = await ref
      .watch(qrAccesosRepositorioProvider)
      .listar(estado: EstadoQr.vigente, pagina: 1, porPagina: 1);
  return pagina.total;
});

class FilaMiActividad extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(sesionControladorProvider).tiene(Permisos.verQr)) {
      return const SizedBox.shrink();
    }
    final l10n = context.l10n;
    final hoy = formatearFecha(ref.read(relojProvider)());
    final total = ref.watch(_qrVigentesDeHoy);
    return FilaClaveValor(
      clave: l10n.perfilMiActividad(hoy),
      icono: Icons.event_available_outlined,
      invertida: true,
      claveEnfatizada: true,
      valorWidget: total.when(
        loading: () => const AccesoSkeleton(ancho: 120),
        error: (_, _) => Text(l10n.comunGuion),
        data: (n) => Text(l10n.perfilQrVigentes(n)),
      ),
      alTocar: () => context.go(Rutas.qrMios),
    );
  }
}
