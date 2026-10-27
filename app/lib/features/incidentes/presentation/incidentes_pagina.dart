import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:agrocom_acceso/features/incidentes/presentation/incidentes_controlador.dart';
import 'package:agrocom_acceso/features/incidentes/presentation/textos_de_incidente.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_accion_fila.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_selector.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Los incidentes de uso de mi rama (ADR 0033 §4), con sus filtros. Un
/// incidente aislado no limita nada: la política de arriba dice cuántos
/// confirmados hacen falta para que el sistema proponga un paso. Solo se ve
/// lo que la API deja ver a quien pregunta (su rama, o lo propio).
class IncidentesPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final filtro = ref.watch(filtroIncidentesProvider);
    final listado = ref.watch(listadoIncidentesProvider(filtro));
    final ahora = ref.read(relojProvider)();

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.incidentesTitulo,
      rutaAtras: Rutas.perfil,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.perfil),
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
            child: _Filtros(filtro: filtro),
          ),
          Expanded(
            child: ListadoPaginado<Incidente>(
              estado: estadoDesdeAsync(listado, ahora: ahora),
              tituloDeError: l10n.incidentesErrorCargar,
              alReintentar: () => ref.invalidate(listadoIncidentesProvider),
              alCambiarPagina: ref
                  .read(filtroIncidentesProvider.notifier)
                  .irAPagina,
              // Con poca altura (horizontal) la ilustración y el texto se
              // desplazan en vez de desbordar.
              vacio: SingleChildScrollView(
                child: EstadoVacio(
                  ilustracion: Multimedia.bloqueo,
                  titulo: l10n.incidentesVacioTitulo,
                  ayuda: l10n.incidentesVacioAyuda,
                ),
              ),
              tarjeta: (context, incidente) => _TarjetaIncidente(
                incidente: incidente,
                alAbrir: () => context.go(Rutas.incidente(incidente.id)),
              ),
              columnas: [
                ColumnaListado(
                  titulo: l10n.incidentesColumnaOcurrido,
                  celda: (context, incidente) => Text(
                    formatearFechaHora(incidente.ocurridoAt),
                    style: tokens.tipografia.mono(
                      tokens.tipografia.t14,
                      color: tokens.colores.texto,
                    ),
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.incidentesColumnaUsuario,
                  celda: (context, incidente) => Text(
                    nombreDeUsuario(l10n, incidente.usuarioEtiqueta),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.incidentesColumnaTipo,
                  celda: (context, incidente) =>
                      Text(textoDeTipoDeIncidente(l10n, incidente.tipo)),
                ),
                ColumnaListado(
                  titulo: l10n.incidentesColumnaGravedad,
                  celda: (context, incidente) =>
                      Text(textoDeGravedad(l10n, incidente.gravedad)),
                ),
                ColumnaListado(
                  titulo: l10n.incidentesColumnaOrigen,
                  celda: (context, incidente) =>
                      Text(textoDeOrigen(l10n, incidente.origen)),
                ),
                ColumnaListado(
                  titulo: l10n.comunEstado,
                  celda: (context, incidente) => AccesoBadge(
                    texto: textoDeEstado(l10n, incidente.estado),
                    tono: tonoDeEstado(incidente.estado),
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.comunAcciones,
                  celda: (context, incidente) => AccesoAccionFila(
                    accion: AccionDeFila.ver,
                    etiqueta: l10n.incidentesVer(
                      nombreDeUsuario(l10n, incidente.usuarioEtiqueta),
                    ),
                    onPressed: () => context.go(Rutas.incidente(incidente.id)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Los dos filtros del listado: tipo y estado. Cada uno tiene "Todos".
class _Filtros extends ConsumerWidget {
  const new({required this.filtro});

  final FiltroIncidentes filtro;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final todos = l10n.incidentesFiltroTodos;
    final notifier = ref.read(filtroIncidentesProvider.notifier);
    return Row(
      children: [
        Expanded(
          child: AccesoSelector<TipoDeIncidente?>(
            opciones: [
              OpcionSelector(valor: null, etiqueta: todos),
              for (final tipo in TipoDeIncidente.values)
                OpcionSelector(
                  valor: tipo,
                  etiqueta: textoDeTipoDeIncidente(l10n, tipo),
                ),
            ],
            seleccionado: filtro.tipo,
            alElegir: notifier.elegirTipo,
            placeholder: l10n.incidentesFiltroTipo,
          ),
        ),
        SizedBox(width: tokens.espacio.s),
        Expanded(
          child: AccesoSelector<EstadoDeIncidente?>(
            opciones: [
              OpcionSelector(valor: null, etiqueta: todos),
              for (final estado in EstadoDeIncidente.values)
                OpcionSelector(
                  valor: estado,
                  etiqueta: textoDeEstado(l10n, estado),
                ),
            ],
            seleccionado: filtro.estado,
            alElegir: notifier.elegirEstado,
            placeholder: l10n.incidentesFiltroEstado,
          ),
        ),
      ],
    );
  }
}

/// Un incidente en compacto: quién, qué tipo y cuándo, y su estado. Toda la
/// tarjeta abre el detalle.
class _TarjetaIncidente extends StatelessWidget {
  const new({required this.incidente, required this.alAbrir});

  final Incidente incidente;
  final VoidCallback alAbrir;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return TarjetaFila(
      titulo: nombreDeUsuario(l10n, incidente.usuarioEtiqueta),
      subtituloWidget: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            textoDeTipoDeIncidente(l10n, incidente.tipo),
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: tokens.colores.textoSecundario),
          ),
          Text(
            formatearFechaHora(incidente.ocurridoAt),
            style: tokens.tipografia.mono(
              tokens.tipografia.t12,
              color: tokens.colores.textoSecundario,
            ),
          ),
        ],
      ),
      fin: AccesoBadge(
        texto: textoDeEstado(l10n, incidente.estado),
        tono: tonoDeEstado(incidente.estado),
      ),
      alTocar: alAbrir,
    );
  }
}
