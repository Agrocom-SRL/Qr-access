import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/estado_qr_vista.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mis_qr_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/tarjeta_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/vencimiento_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Listado de los QR emitidos, por estado (HU-13, handoff C07/E07): filtrar,
/// ver y anular. Tarjetas en compacto, tabla en expandido.
class MisQrPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final filtro = ref.watch(filtroQrProvider);
    final listado = ref.watch(listadoQrProvider);
    final resumen = ref.watch(resumenQrProvider).value;
    final anulando = ref.watch(anularQrControladorProvider);
    final ahora = ref.read(relojProvider)();
    final puedeEmitir = sesion.tiene(Permisos.emitirQr);
    final puedeAnular = sesion.tiene(Permisos.anularQr);
    final expandida = context.esExpandida;

    final botonEmitir = AccesoBoton(
      texto: l10n.qrEmitirBoton,
      icono: Icons.add,
      onPressed: () => context.go(Rutas.qrNuevo),
    );

    return PlantillaAdmin(
      destino: DestinoNav.misQr,
      titulo: l10n.qrMisQrTitulo,
      accion: puedeEmitir && expandida ? botonEmitir : null,
      fab: puedeEmitir
          ? FloatingActionButton.extended(
              onPressed: () => context.go(Rutas.qrNuevo),
              icon: const Icon(Icons.add),
              label: Text(l10n.qrEmitirBoton),
            )
          : null,
      conRelleno: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(
              tokens.espacio.l,
              tokens.espacio.l,
              tokens.espacio.l,
              0,
            ),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: SelectorSegmentado<EstadoQr>(
                estirado: !expandida,
                segmentos: [
                  for (final estado in EstadoQr.values)
                    SegmentoDeSelector(
                      valor: estado,
                      etiqueta: textoFiltroQr(l10n, estado),
                      conteo: expandida && resumen != null
                          ? resumen[estado]
                          : null,
                    ),
                ],
                seleccionado: filtro.estado,
                alElegir: ref.read(filtroQrProvider.notifier).elegirEstado,
              ),
            ),
          ),
          Expanded(
            child: ListadoPaginado<QrAcceso>(
              estado: estadoDesdeAsync(listado, ahora: ahora),
              tituloDeError: l10n.qrMisQrErrorCargar,
              alReintentar: () => ref
                ..invalidate(listadoQrProvider)
                ..invalidate(resumenQrProvider),
              alCambiarPagina: ref.read(filtroQrProvider.notifier).irAPagina,
              vacio: EstadoVacio(
                icono: Icons.qr_code_2,
                titulo: filtro.estado == EstadoQr.vigente
                    ? l10n.qrMisQrSinVigentes
                    : l10n.qrMisQrSinResultados,
                ayuda: l10n.qrMisQrSinResultadosAyuda,
                textoAccion: puedeEmitir ? l10n.qrEmitirBoton : null,
                iconoAccion: Icons.add,
                alAccionar: puedeEmitir
                    ? () => context.go(Rutas.qrNuevo)
                    : null,
              ),
              tarjeta: (context, qr) => TarjetaQr(
                qr: qr,
                ahora: ahora,
                anulando: anulando,
                alAnular: puedeAnular ? () => _anular(context, ref, qr) : null,
              ),
              columnas: [
                ColumnaListado(
                  titulo: l10n.qrColumnaEtiqueta,
                  celda: (context, qr) => Text(
                    qr.etiqueta ?? l10n.qrSinEtiqueta,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.qrColumnaPuertas,
                  celda: (context, qr) => Text(
                    qr.nombresDePuertas,
                    style: Theme.of(context).textTheme.bodyMedium
                        ?.copyWith(color: tokens.colores.textoSecundario),
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.qrColumnaEmitido,
                  celda: (context, qr) =>
                      _Mono(textoHoraCorta(l10n, qr.creadoAt, ahora)),
                ),
                ColumnaListado(
                  titulo: l10n.qrColumnaVence,
                  celda: (context, qr) =>
                      _Mono(textoHoraCorta(l10n, qr.venceAt, ahora)),
                ),
                ColumnaListado(
                  titulo: l10n.comunEstado,
                  celda: (context, qr) => AccesoBadge(
                    texto: textoEstadoQr(l10n, qr.estado),
                    tono: tonoEstadoQr(qr.estado),
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.comunAcciones,
                  celda: (context, qr) => qr.puedeAnularse && puedeAnular
                      ? Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: AccesoBoton(
                            texto: l10n.qrAnular,
                            icono: Icons.block,
                            variante: VarianteBoton.peligroTexto,
                            cargando: anulando,
                            onPressed: () => _anular(context, ref, qr),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Pide confirmación con la ficha "Vigente → Anulado" y anula.
  Future<void> _anular(BuildContext context, WidgetRef ref, QrAcceso qr) async {
    final l10n = context.l10n;
    final confirmado = await ConfirmarDialogo.mostrar(
      context,
      titulo: l10n.qrAnularTitulo,
      detalle: l10n.qrEtiquetaYPuertas(
        qr.etiqueta ?? l10n.qrSinEtiqueta,
        qr.nombresDePuertas,
      ),
      icono: Icons.block,
      mensaje: l10n.qrAnularMensaje,
      textoConfirmar: l10n.qrAnular,
      transicion: TransicionDeEstado(
        actual: textoEstadoQr(l10n, EstadoQr.vigente),
        tonoActual: tonoEstadoQr(EstadoQr.vigente),
        destino: textoEstadoQr(l10n, EstadoQr.anulado),
        tonoDestino: tonoEstadoQr(EstadoQr.anulado),
      ),
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

class _Mono extends StatelessWidget {
  const new(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Text(
      texto,
      style: tokens.tipografia.mono(
        tokens.tipografia.t14,
        color: tokens.colores.texto,
      ),
    );
  }
}
