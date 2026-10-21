import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
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
import 'package:agrocom_acceso/shared/widgets/molecules/pestanas_deslizables.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Listado de los QR generados, por estado (HU-13, handoff C07/E07): filtrar,
/// ver y anular. Tarjetas en compacto, tabla en expandido.
class MisQrPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final filtro = ref.watch(filtroQrProvider);
    final resumen = ref.watch(resumenQrProvider).value;
    final puedeGenerar = sesion.tiene(Permisos.generarQr);
    final expandida = context.esExpandida;

    final botonGenerar = AccesoBoton(
      texto: l10n.qrGenerarBoton,
      icono: Icons.add,
      onPressed: () => context.go(Rutas.qrNuevo),
    );

    final segmentos = [
      for (final estado in EstadoQr.values)
        SegmentoDeSelector(
          valor: estado,
          etiqueta: textoFiltroQr(l10n, estado),
          conteo: expandida && resumen != null ? resumen[estado] : null,
        ),
    ];

    return PlantillaAdmin(
      destino: DestinoNav.misQr,
      titulo: expandida ? l10n.qrMisQrTitulo : null,
      accion: puedeGenerar && expandida ? botonGenerar : null,
      fab: puedeGenerar
          ? FloatingActionButton.extended(
              onPressed: () => context.go(Rutas.qrNuevo),
              icon: const Icon(Icons.add),
              label: Text(l10n.qrGenerarBoton),
            )
          : null,
      conRelleno: false,
      // En pantallas chicas, pestañas que se deslizan; en la ancha, el
      // selector de siempre sobre una sola tabla.
      child: expandida
          ? Column(
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
                      estirado: false,
                      segmentos: segmentos,
                      seleccionado: filtro.estado,
                      alElegir: ref
                          .read(filtroQrProvider.notifier)
                          .elegirEstado,
                    ),
                  ),
                ),
                Expanded(child: _ListaQr(estado: filtro.estado)),
              ],
            )
          : PestanasDeslizables<EstadoQr>(
              segmentos: segmentos,
              seleccionado: filtro.estado,
              alElegir: ref.read(filtroQrProvider.notifier).elegirEstado,
              paginaDe: (context, estado) => _ListaQr(estado: estado),
            ),
    );
  }
}

/// El listado de un estado: tarjetas en compacto, tabla en expandido. La
/// página de cada pestaña es la suya; las demás vuelven a la primera.
class _ListaQr extends ConsumerWidget {
  const new({required this.estado});

  final EstadoQr estado;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final elegido = ref.watch(filtroQrProvider);
    final filtro = FiltroQr(
      estado: estado,
      pagina: elegido.estado == estado ? elegido.pagina : 1,
    );
    final listado = ref.watch(listadoQrProvider(filtro));
    final anulando = ref.watch(anularQrControladorProvider);
    final ahora = ref.read(relojProvider)();
    final puedeGenerar = sesion.tiene(Permisos.generarQr);
    final puedeAnular = sesion.tiene(Permisos.anularQr);

    return ListadoPaginado<QrAcceso>(
      estado: estadoDesdeAsync(listado, ahora: ahora),
      tituloDeError: l10n.qrMisQrErrorCargar,
      alReintentar: () => ref
        ..invalidate(listadoQrProvider)
        ..invalidate(resumenQrProvider),
      alCambiarPagina: ref.read(filtroQrProvider.notifier).irAPagina,
      vacio: EstadoVacio(
        ilustracion: Multimedia.vacioQr,
        titulo: estado == EstadoQr.vigente
            ? l10n.qrMisQrSinVigentes
            : l10n.qrMisQrSinResultados,
        ayuda: l10n.qrMisQrSinResultadosAyuda,
        textoAccion: puedeGenerar ? l10n.qrGenerarBoton : null,
        iconoAccion: Icons.add,
        alAccionar: puedeGenerar ? () => context.go(Rutas.qrNuevo) : null,
      ),
      tarjeta: (context, qr) => _TarjetaQrConVer(
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
          titulo: l10n.qrColumnaGenerado,
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
          celda: (context, qr) => _AccionesDeFila(
            qr: qr,
            anulando: anulando,
            alAnular: puedeAnular ? () => _anular(context, ref, qr) : null,
          ),
        ),
      ],
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

/// Tarjeta de un QR con "Ver QR" si el texto está en este dispositivo, o el
/// aviso de que se generó en otro.
class _TarjetaQrConVer extends ConsumerWidget {
  const new({
    required this.qr,
    required this.ahora,
    required this.anulando,
    required this.alAnular,
  });

  final QrAcceso qr;
  final DateTime ahora;
  final bool anulando;
  final VoidCallback? alAnular;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vigente = qr.estado == EstadoQr.vigente;
    final texto = vigente
        ? ref.watch(textoQrGuardadoProvider(qr.id))
        : const AsyncData<String?>(null);
    final guardado = texto.value;
    return TarjetaQr(
      qr: qr,
      ahora: ahora,
      anulando: anulando,
      alAnular: alAnular,
      alVer: guardado == null
          ? null
          : () => abrirQrGuardado(context, qr, guardado),
      soloEnOtroDispositivo: vigente && texto.hasValue && guardado == null,
    );
  }
}

/// Acciones de la fila de la tabla (expandido): ver y anular.
class _AccionesDeFila extends ConsumerWidget {
  const new({required this.qr, required this.anulando, required this.alAnular});

  final QrAcceso qr;
  final bool anulando;
  final VoidCallback? alAnular;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final guardado = qr.estado == EstadoQr.vigente
        ? ref.watch(textoQrGuardadoProvider(qr.id)).value
        : null;
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (guardado != null)
          AccesoBoton(
            texto: l10n.qrVerQr,
            icono: Icons.qr_code_2,
            variante: VarianteBoton.texto,
            onPressed: () => abrirQrGuardado(context, qr, guardado),
          ),
        if (qr.puedeAnularse && alAnular != null)
          AccesoBoton(
            texto: l10n.qrAnular,
            icono: Icons.block,
            variante: VarianteBoton.peligroTexto,
            cargando: anulando,
            onPressed: alAnular,
          ),
      ],
    );
  }
}

/// Vuelve a mostrar un QR ya generado con el texto guardado en el dispositivo.
void abrirQrGuardado(BuildContext context, QrAcceso qr, String texto) {
  context.go(
    Rutas.qrGenerado,
    extra: QrGenerado(
      id: qr.id,
      texto: texto,
      venceAt: qr.venceAt,
      etiqueta: qr.etiqueta,
      puertas: qr.puertas,
      repaso: true,
    ),
  );
}
