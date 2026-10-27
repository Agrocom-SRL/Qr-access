import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:agrocom_acceso/features/notificaciones/presentation/notificaciones_controlador.dart';
import 'package:agrocom_acceso/features/notificaciones/presentation/widgets/presentacion_de_notificacion.dart';
import 'package:agrocom_acceso/features/notificaciones/presentation/widgets/tarjeta_notificacion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_accion_fila.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/pestanas_deslizables.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// La bandeja de notificaciones de la cuenta (ADR 0030 §6): lo que el sistema
/// avisa a quien administra, con su severidad, y si ya se leyó. Se filtra
/// entre todas y las no leídas (pestañas deslizables, como en Lecturas);
/// marcar leída es una sola acción por aviso o todas juntas.
class NotificacionesPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colores = context.tokens.colores;
    final sesion = ref.watch(sesionControladorProvider);
    final filtro = ref.watch(filtroNotificacionesProvider);
    final noLeidas = ref.watch(contadorNotificacionesProvider).value ?? 0;
    final marcando = ref.watch(marcarNotificacionesProvider);
    final puedeMarcar = sesion.tiene(Permisos.gestionarNotificaciones);
    final marcarTodas = puedeMarcar && noLeidas > 0 && !marcando
        ? () => _marcarTodas(context, ref)
        : null;

    return PlantillaAdmin(
      destino: DestinoNav.inicio,
      titulo: l10n.notificacionesTitulo,
      rutaAtras: Rutas.inicio,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.inicio),
      accion: puedeMarcar && noLeidas > 0
          ? AccesoBoton(
              texto: l10n.notificacionesLeerTodas,
              icono: Icons.done_all,
              variante: VarianteBoton.tonal,
              onPressed: marcarTodas,
            )
          : null,
      accionCompacta: puedeMarcar && noLeidas > 0
          ? IconButton(
              tooltip: l10n.notificacionesLeerTodas,
              color: colores.primario,
              onPressed: marcarTodas,
              icon: const Icon(Icons.done_all),
            )
          : null,
      conRelleno: false,
      child: PestanasDeslizables<bool>(
        segmentos: [
          SegmentoDeSelector(
            valor: false,
            etiqueta: l10n.notificacionesFiltroTodas,
          ),
          SegmentoDeSelector(
            valor: true,
            etiqueta: l10n.notificacionesFiltroNoLeidas,
          ),
        ],
        seleccionado: filtro.soloNoLeidas,
        alElegir: (soloNoLeidas) => ref
            .read(filtroNotificacionesProvider.notifier)
            .elegirSoloNoLeidas(soloNoLeidas: soloNoLeidas),
        paginaDe: (context, soloNoLeidas) =>
            _ListaNotificaciones(soloNoLeidas: soloNoLeidas),
      ),
    );
  }
}

/// La bandeja de una pestaña: todas o solo las no leídas. Cada pestaña tiene
/// su propio listado; la página elegida solo aplica a la pestaña activa.
class _ListaNotificaciones extends ConsumerWidget {
  const new({required this.soloNoLeidas});

  final bool soloNoLeidas;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final sesion = ref.watch(sesionControladorProvider);
    final elegido = ref.watch(filtroNotificacionesProvider);
    final filtro = FiltroNotificaciones(
      soloNoLeidas: soloNoLeidas,
      pagina: elegido.soloNoLeidas == soloNoLeidas ? elegido.pagina : 1,
    );
    final listado = ref.watch(listadoNotificacionesProvider(filtro));
    final ahora = ref.read(relojProvider)();
    final marcando = ref.watch(marcarNotificacionesProvider);
    final puedeMarcar = sesion.tiene(Permisos.gestionarNotificaciones);
    final puedeVerIncidentes = sesion.tiene(Permisos.verIncidentes);

    return ListadoPaginado<Notificacion>(
      estado: estadoDesdeAsync(listado, ahora: ahora),
      tituloDeError: l10n.notificacionesErrorCargar,
      alReintentar: () {
        ref
          ..invalidate(listadoNotificacionesProvider)
          ..invalidate(contadorNotificacionesProvider);
      },
      alCambiarPagina: ref
          .read(filtroNotificacionesProvider.notifier)
          .irAPagina,
      vacio: EstadoVacio(
        ilustracion: Multimedia.vacioEventos,
        titulo: soloNoLeidas
            ? l10n.notificacionesSinNoLeidas
            : l10n.notificacionesSinNotificaciones,
      ),
      tarjeta: (context, aviso) => _TarjetaDeAviso(
        aviso: aviso,
        puedeMarcar: puedeMarcar,
        marcando: marcando,
        puedeVerIncidentes: puedeVerIncidentes,
      ),
      columnas: [
        ColumnaListado(
          titulo: l10n.notificacionesColumnaAviso,
          celda: (context, aviso) => Text(
            textoDeTipo(l10n, aviso.tipo),
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ),
        ColumnaListado(
          titulo: l10n.notificacionesColumnaDetalle,
          celda: (context, aviso) {
            final detalle = detalleDeNotificacion(l10n, aviso);
            if (detalle == null) return const SizedBox.shrink();
            return Text(
              detalle,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: colores.textoSecundario),
            );
          },
        ),
        ColumnaListado(
          titulo: l10n.notificacionesColumnaSeveridad,
          celda: (context, aviso) => AccesoBadge(
            texto: textoDeSeveridad(l10n, aviso.severidad),
            tono: tonoDeSeveridad(aviso.severidad),
          ),
        ),
        ColumnaListado(
          titulo: l10n.notificacionesColumnaRecibida,
          celda: (context, aviso) => Text(
            formatearFechaHora(aviso.novedadAt),
            style: tokens.tipografia.mono(
              tokens.tipografia.t14,
              color: colores.texto,
            ),
          ),
        ),
        ColumnaListado(
          titulo: l10n.comunEstado,
          celda: (context, aviso) => AccesoBadge(
            texto: aviso.leida
                ? l10n.notificacionesLeida
                : l10n.notificacionesNoLeida,
            tono: aviso.leida ? TonoAcceso.neutro : TonoAcceso.primario,
          ),
        ),
        ColumnaListado(
          titulo: l10n.comunAcciones,
          celda: (context, aviso) => _AccionesDeAviso(
            aviso: aviso,
            puedeMarcar: puedeMarcar,
            marcando: marcando,
            puedeVerIncidentes: puedeVerIncidentes,
          ),
        ),
      ],
    );
  }
}

/// Tarjeta de un aviso en compacto: su texto y, si aplica, abrir o marcar
/// leída.
class _TarjetaDeAviso extends ConsumerWidget {
  const new({
    required this.aviso,
    required this.puedeMarcar,
    required this.marcando,
    required this.puedeVerIncidentes,
  });

  final Notificacion aviso;
  final bool puedeMarcar;
  final bool marcando;
  final bool puedeVerIncidentes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TarjetaNotificacion(
      aviso: aviso,
      puedeMarcar: puedeMarcar,
      marcando: marcando,
      alMarcarLeida: () => _marcarLeida(context, ref, aviso),
      alAbrir: _alAbrirPropuesta(context, aviso, puedeVerIncidentes),
    );
  }
}

/// Acciones de un aviso en la tabla: abrir la propuesta y marcar leída.
class _AccionesDeAviso extends ConsumerWidget {
  const new({
    required this.aviso,
    required this.puedeMarcar,
    required this.marcando,
    required this.puedeVerIncidentes,
  });

  final Notificacion aviso;
  final bool puedeMarcar;
  final bool marcando;
  final bool puedeVerIncidentes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final abrir = _alAbrirPropuesta(context, aviso, puedeVerIncidentes);
    final marcar = puedeMarcar && aviso.puedeMarcarLeida;
    if (abrir == null && !marcar) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (abrir != null)
          AccesoAccionFila(
            accion: AccionDeFila.ver,
            etiqueta: l10n.incidentesVer(
              aviso.usuario ?? l10n.incidentesUsuarioSinNombre,
            ),
            onPressed: abrir,
          ),
        if (marcar)
          AccesoBoton(
            texto: l10n.notificacionesMarcarLeida,
            variante: VarianteBoton.texto,
            onPressed: marcando
                ? null
                : () => _marcarLeida(context, ref, aviso),
          ),
      ],
    );
  }
}

/// Un aviso de propuesta abre su incidente, si quien mira puede verlo.
/// `null` en los demás avisos o sin ese permiso.
VoidCallback? _alAbrirPropuesta(
  BuildContext context,
  Notificacion aviso,
  bool puedeVerIncidentes,
) {
  final propuesta = aviso.propuesta;
  if (propuesta == null || !puedeVerIncidentes) return null;
  return () => context.go(Rutas.incidente(propuesta.incidenteId));
}

Future<void> _marcarLeida(
  BuildContext context,
  WidgetRef ref,
  Notificacion aviso,
) async {
  final error = await ref
      .read(marcarNotificacionesProvider.notifier)
      .marcarLeida(aviso.id);
  if (error == null || !context.mounted) return;
  _avisar(context, textoDeError(context.l10n, error));
}

Future<void> _marcarTodas(BuildContext context, WidgetRef ref) async {
  final l10n = context.l10n;
  final resultado = await ref
      .read(marcarNotificacionesProvider.notifier)
      .marcarTodas();
  if (!context.mounted) return;
  final error = resultado.error;
  _avisar(
    context,
    error == null
        ? l10n.notificacionesMarcadas(resultado.marcadas)
        : textoDeError(l10n, error),
  );
}

void _avisar(BuildContext context, String texto) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
}
