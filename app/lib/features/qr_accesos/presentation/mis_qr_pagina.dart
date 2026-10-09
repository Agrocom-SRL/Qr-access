import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/estado_qr_vista.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/tarjeta_qr.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_error.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Listado de los QR emitidos, por estado (HU-13): ver, filtrar y anular.
class MisQrPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final filtro = ref.watch(filtroQrProvider);
    final listado = ref.watch(listadoQrProvider);
    final anulando = ref.watch(anularQrControladorProvider);

    return PlantillaPantalla(
      titulo: l10n.qrMisQrTitulo,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.all(tokens.espacio.l),
            child: Wrap(
              spacing: tokens.espacio.s,
              runSpacing: tokens.espacio.s,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                for (final estado in EstadoQr.values)
                  ChoiceChip(
                    label: Text(textoEstadoQr(l10n, estado)),
                    selected: estado == filtro.estado,
                    onSelected: (_) => ref
                        .read(filtroQrProvider.notifier)
                        .elegirEstado(estado),
                  ),
                if (sesion.tiene(Permisos.emitirQr))
                  AccesoBoton(
                    texto: l10n.qrMisQrNuevo,
                    icono: Icons.add,
                    onPressed: () => context.go(Rutas.qrNuevo),
                  ),
              ],
            ),
          ),
          Expanded(
            child: listado.when(
              loading: () => const AccesoCargando(),
              error: (error, _) => EstadoError(
                mensaje: textoDeError(l10n, error),
                alReintentar: () => ref.invalidate(listadoQrProvider),
              ),
              data: (pagina) => pagina.datos.isEmpty
                  ? EstadoVacio(
                      icono: Icons.qr_code_2,
                      titulo: l10n.qrMisQrSinResultados,
                      ayuda: l10n.qrMisQrSinResultadosAyuda,
                    )
                  : ListadoPaginado<QrAcceso>(
                      pagina: pagina,
                      alCambiarPagina: ref
                          .read(filtroQrProvider.notifier)
                          .irAPagina,
                      itemBuilder: (context, qr) => TarjetaQr(
                        qr: qr,
                        anulando: anulando,
                        alAnular: sesion.tiene(Permisos.anularQr)
                            ? () => _anular(context, ref, qr)
                            : null,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// Pide confirmación y anula. El estado destino es "anulado": tono de
  /// peligro.
  Future<void> _anular(BuildContext context, WidgetRef ref, QrAcceso qr) async {
    final l10n = context.l10n;
    final confirmado = await ConfirmarDialogo.mostrar(
      context,
      titulo: l10n.qrAnularTitulo,
      mensaje: l10n.qrAnularMensaje,
      textoConfirmar: l10n.qrAnularConfirmar,
    );
    if (!confirmado || !context.mounted) return;
    final error = await ref
        .read(anularQrControladorProvider.notifier)
        .anular(qr.id);
    if (error != null && context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(textoDeError(l10n, error))));
    }
  }
}
