import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/features/eventos/presentation/evento_vista.dart';
import 'package:agrocom_acceso/features/eventos/presentation/eventos_controlador.dart';
import 'package:agrocom_acceso/features/eventos/presentation/widgets/fila_evento.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_selector.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/desliza_entre_opciones.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

/// Bitácora de intentos de acceso (HU-15, handoff C08/E08): filtros por
/// resultado y puerta, tarjetas agrupadas por día en compacto y tabla con
/// segundos en expandido.
class EventosPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<EventosPagina> createState() => _EventosPaginaEstado();
}

class _EventosPaginaEstado extends ConsumerState<EventosPagina> {
  var _mostrarFiltroDePuerta = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final consulta = ref.watch(consultaEventosProvider);
    final controlador = ref.read(consultaEventosProvider.notifier);
    final eventos = ref.watch(eventosProvider);
    final puertas = ref.watch(puertasDisponiblesProvider).value ?? const [];
    final ahora = ref.read(relojProvider)();
    final expandida = context.esExpandida;
    final conFiltroDePuerta = expandida || _mostrarFiltroDePuerta;
    final hayFiltro =
        consulta.filtro.resultado != null || consulta.filtro.puertaId != null;

    final selectorDePuerta = AccesoSelector<String?>(
      placeholder: l10n.eventosTodasLasPuertas,
      iconoInicial: Icons.door_front_door_outlined,
      seleccionado: consulta.filtro.puertaId,
      alElegir: controlador.elegirPuerta,
      opciones: [
        OpcionSelector(valor: null, etiqueta: l10n.eventosTodasLasPuertas),
        for (final puerta in puertas)
          OpcionSelector(valor: puerta.id, etiqueta: puerta.nombre),
      ],
    );

    final filtros = Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.espacio.l,
        tokens.espacio.l,
        tokens.espacio.l,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                flex: expandida ? 0 : 1,
                child: SelectorSegmentado<ResultadoEvento?>(
                  estirado: !expandida,
                  segmentos: [
                    SegmentoDeSelector(
                      valor: null,
                      etiqueta: l10n.eventosFiltroTodos,
                    ),
                    SegmentoDeSelector(
                      valor: ResultadoEvento.permitido,
                      etiqueta: l10n.eventosFiltroPermitidos,
                    ),
                    SegmentoDeSelector(
                      valor: ResultadoEvento.rechazado,
                      etiqueta: l10n.eventosFiltroRechazados,
                    ),
                  ],
                  seleccionado: consulta.filtro.resultado,
                  alElegir: controlador.elegirResultado,
                ),
              ),
              if (expandida) ...[
                SizedBox(width: tokens.espacio.l),
                SizedBox(
                  width: tokens.tamano.railExpandido,
                  child: selectorDePuerta,
                ),
              ],
            ],
          ),
          if (!expandida && _mostrarFiltroDePuerta) ...[
            SizedBox(height: tokens.espacio.m),
            selectorDePuerta,
          ],
        ],
      ),
    );

    return PlantillaAdmin(
      destino: DestinoNav.eventos,
      titulo: l10n.eventosTitulo,
      accionCompacta: IconButton(
        tooltip: l10n.eventosFiltrar,
        onPressed: () =>
            setState(() => _mostrarFiltroDePuerta = !_mostrarFiltroDePuerta),
        icon: Icon(
          conFiltroDePuerta ? Icons.filter_list_off : Icons.filter_list,
        ),
      ),
      conRelleno: false,
      child: DeslizaEntreOpciones<ResultadoEvento?>(
        activo: !expandida,
        opciones: const [
          null,
          ResultadoEvento.permitido,
          ResultadoEvento.rechazado,
        ],
        seleccionada: consulta.filtro.resultado,
        alCambiar: controlador.elegirResultado,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            filtros,
            Expanded(
              child: ListadoPaginado<EventoAcceso>(
                estado: estadoDesdeAsync(eventos, ahora: ahora),
                tituloDeError: l10n.eventosErrorCargar,
                alReintentar: () => ref.invalidate(eventosProvider),
                alCambiarPagina: controlador.irAPagina,
                vacio: EstadoVacio(
                  ilustracion: Multimedia.vacioEventos,
                  titulo: hayFiltro
                      ? l10n.eventosSinResultadosFiltro
                      : l10n.eventosSinResultados,
                  ayuda: hayFiltro
                      ? l10n.eventosSinResultadosFiltroAyuda
                      : l10n.eventosSinResultadosAyuda,
                  textoAccion: hayFiltro ? l10n.comunQuitarFiltros : null,
                  alAccionar: hayFiltro
                      ? () {
                          controlador
                            ..elegirResultado(null)
                            ..elegirPuerta(null);
                        }
                      : null,
                ),
                encabezadoDe: (evento, anterior) =>
                    anterior == null ||
                        !mismoDiaLocal(evento.ocurridoAt, anterior.ocurridoAt)
                    ? _tituloDelDia(l10n, evento.ocurridoAt, ahora)
                    : null,
                tarjeta: (context, evento) => TarjetaEvento(evento: evento),
                columnas: [
                  ColumnaListado(
                    titulo: l10n.eventosColumnaHora,
                    ancho: tokens.tamano.columnaHora,
                    celda: (context, evento) => Text(
                      formatearHoraConSegundos(evento.ocurridoAt),
                      style: tokens.tipografia.mono(
                        tokens.tipografia.t14,
                        color: tokens.colores.texto,
                      ),
                    ),
                  ),
                  ColumnaListado(
                    titulo: l10n.eventosColumnaPuerta,
                    celda: (context, evento) => Text(
                      evento.puertaNombre,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  ColumnaListado(
                    titulo: l10n.eventosColumnaSitio,
                    celda: (context, evento) => Text(
                      evento.sitioNombre,
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(color: tokens.colores.textoSecundario),
                    ),
                  ),
                  ColumnaListado(
                    titulo: l10n.eventosColumnaQr,
                    celda: (context, evento) => Text(
                      evento.qrEtiqueta == null && evento.emisorEtiqueta == null
                          ? l10n.comunGuion
                          : textoDetalleEvento(
                              l10n,
                              EventoAcceso(
                                id: evento.id,
                                ocurridoAt: evento.ocurridoAt,
                                resultado: ResultadoEvento.permitido,
                                motivoCode: evento.motivoCode,
                                puertaNombre: evento.puertaNombre,
                                sitioNombre: evento.sitioNombre,
                                qrEtiqueta: evento.qrEtiqueta,
                                emisorEtiqueta: evento.emisorEtiqueta,
                              ),
                            ),
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(color: tokens.colores.textoSecundario),
                    ),
                  ),
                  ColumnaListado(
                    titulo: l10n.eventosColumnaResultado,
                    celda: (context, evento) => AccesoBadge(
                      texto: textoResultadoEvento(l10n, evento.resultado),
                      tono: tonoResultadoEvento(evento.resultado),
                    ),
                  ),
                  ColumnaListado(
                    titulo: l10n.eventosColumnaMotivo,
                    celda: (context, evento) => Text(
                      evento.esPermitido
                          ? l10n.comunGuion
                          : textoMotivoEvento(l10n, evento.motivoCode),
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(color: tokens.colores.textoSecundario),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Hoy · jueves 9 oct", "Ayer · …" o la fecha, para agrupar por día.
String _tituloDelDia(AppLocalizations l10n, DateTime fecha, DateTime ahora) {
  final dia = DateFormat('EEEE d MMM', l10n.localeName).format(fecha.toLocal());
  final diasAtras = diaLocal(ahora).difference(diaLocal(fecha)).inDays;
  if (diasAtras == 0) return l10n.comunHoyPunto(dia);
  if (diasAtras == 1) return l10n.comunAyerPunto(dia);
  return dia;
}
