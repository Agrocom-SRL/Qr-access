import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/pestanas_deslizables.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/formulario_secciones.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Hasta cuántos años atrás deja elegir el calendario. Es un límite de la
/// pantalla para no hojear décadas, no un tope de la API.
const anosDeHistorialExportable = 5;

/// Exportar los datos de mis usuarios en CSV (ADR 0033 §3), solo para el
/// Administrador. Cada recurso es una pestaña que se desliza. Se baja de a una
/// página: cada página cuenta contra el límite de exportaciones por minuto, y
/// si hay más filas que el tope, la pantalla lo dice y pide acotar las fechas.
class ExportacionPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(exportacionControladorProvider);
    final notifier = ref.read(exportacionControladorProvider.notifier);
    final puedeBajar = !estado.descargando && rangoValido(estado.filtros);

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.exportacionTitulo,
      rutaAtras: Rutas.perfil,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.perfil),
      anchoMaximo: tokens.tamano.maxFormularioSecciones,
      conRelleno: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: tokens.espacio.l),
                  Text(
                    l10n.exportacionRecurso,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  SizedBox(height: tokens.espacio.s),
                  Expanded(
                    child: PestanasDeslizables<RecursoExportable>(
                      segmentos: [
                        SegmentoDeSelector(
                          valor: RecursoExportable.usuarios,
                          etiqueta: l10n.exportacionRecursoUsuarios,
                        ),
                        SegmentoDeSelector(
                          valor: RecursoExportable.puertas,
                          etiqueta: l10n.exportacionRecursoPuertas,
                        ),
                        SegmentoDeSelector(
                          valor: RecursoExportable.lecturas,
                          etiqueta: l10n.exportacionRecursoLecturas,
                        ),
                      ],
                      seleccionado: estado.recurso,
                      // Con una descarga en curso no se cambia de recurso: la
                      // página que baja es la que se eligió.
                      alElegir: estado.descargando
                          ? (_) {}
                          : notifier.elegirRecurso,
                      paginaDe: (context, recurso) =>
                          _PaginaDeRecurso(recurso: recurso, estado: estado),
                    ),
                  ),
                ],
              ),
            ),
          ),
          BarraDeAcciones(
            acciones: [
              AccesoBoton(
                texto: _textoDelBoton(l10n, estado.ultimo),
                textoCargando: l10n.exportacionDescargando,
                icono: Icons.download_outlined,
                cargando: estado.descargando,
                expandido: true,
                onPressed: puedeBajar ? notifier.descargarSiguiente : null,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// El texto del botón según lo que ya se bajó: la primera página, la que sigue
/// o volver a empezar al terminar.
String _textoDelBoton(AppLocalizations l10n, ResumenDePagina? ultimo) {
  if (ultimo == null) return l10n.exportacionDescargar;
  if (ultimo.hayMas) {
    return l10n.exportacionSiguiente(ultimo.pagina + 1, ultimo.paginas);
  }
  return l10n.exportacionDescargarDeNuevo;
}

/// Lo que ve cada pestaña: la explicación, los filtros (solo para las lecturas)
/// y lo que dijo la última descarga. Los avisos vienen del estado común porque
/// la descarga solo se conserva para el recurso elegido.
class _PaginaDeRecurso extends StatelessWidget {
  const new({required this.recurso, required this.estado});

  final RecursoExportable recurso;
  final EstadoExportacion estado;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return SingleChildScrollView(
      padding: EdgeInsets.only(bottom: tokens.espacio.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // La foto va dentro del desplazamiento: en horizontal no roba altura.
          ClipRRect(
            borderRadius: BorderRadius.circular(tokens.radio.xl),
            child: SizedBox(
              height: tokens.tamano.cabeceraFoto / 2,
              width: double.infinity,
              child: const AccesoFoto(
                ruta: Multimedia.fotoMuro,
                fundirConFondo: true,
                verdeEnClaro: true,
              ),
            ),
          ),
          SizedBox(height: tokens.espacio.l),
          AccesoAviso(
            tono: TonoAviso.informacion,
            texto: l10n.exportacionSubtitulo,
          ),
          if (recurso == RecursoExportable.lecturas) ...[
            SizedBox(height: tokens.espacio.l),
            AccesoTarjeta(
              relleno: EdgeInsets.all(tokens.espacio.l),
              child: _FiltrosDeLecturas(
                filtros: estado.filtros,
                bloqueado: estado.descargando,
              ),
            ),
          ],
          SizedBox(height: tokens.espacio.l),
          ..._avisos(l10n, tokens, estado),
        ],
      ),
    );
  }
}

/// Lo que dice la pantalla tras bajar: el error, el rango al revés, el
/// resultado o, si no hay filas, un estado vacío con ilustración. Cada aviso va
/// solo cuando corresponde.
List<Widget> _avisos(
  AppLocalizations l10n,
  AccesoTokens tokens,
  EstadoExportacion estado,
) {
  final ultimo = estado.ultimo;
  final error = estado.error;
  return [
    if (!rangoValido(estado.filtros)) ...[
      AccesoAviso(texto: l10n.exportacionRangoInvalido),
      SizedBox(height: tokens.espacio.m),
    ],
    // Sin red o con un fallo de la API, el estado vacío con su ilustración dice
    // qué pasó. Sin botón: el de abajo ya vuelve a bajar.
    if (error != null)
      EstadoVacio(
        variante: error.esSinConexion
            ? VarianteEstadoVacio.sinConexion
            : VarianteEstadoVacio.error,
        titulo: textoDeError(l10n, error),
      ),
    if (ultimo != null && ultimo.total == 0)
      EstadoVacio(
        ilustracion: Multimedia.vacioEventos,
        titulo: l10n.exportacionSinFilas,
        ayuda: l10n.exportacionSinFilasAyuda,
      )
    else if (ultimo != null) ...[
      AccesoAviso(
        tono: TonoAviso.informacion,
        texto: l10n.exportacionDescargada(
          ultimo.pagina,
          ultimo.paginas,
          ultimo.filas,
        ),
      ),
      if (ultimo.truncado) ...[
        SizedBox(height: tokens.espacio.m),
        AccesoAviso(texto: l10n.exportacionTruncado),
      ],
    ],
  ];
}

/// Los filtros que solo valen para las lecturas: el resultado y el rango de
/// días (La Paz). Con el rango abierto, la fecha dice "Sin límite".
class _FiltrosDeLecturas extends ConsumerWidget {
  const new({required this.filtros, required this.bloqueado});

  final FiltrosDeExportacion filtros;
  final bool bloqueado;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final notifier = ref.read(exportacionControladorProvider.notifier);
    final ahora = ref.read(relojProvider)();
    final hoy = horaBolivia(ahora);
    final limiteInferior = DateTime(hoy.year - anosDeHistorialExportable);
    final textoSinLimite = l10n.exportacionSinLimite;

    Future<void> elegir(
      DateTime? actual,
      void Function(DateTime? dia) alElegir,
    ) async {
      final elegido = await showDatePicker(
        context: context,
        initialDate: actual == null ? hoy : horaBolivia(actual),
        firstDate: limiteInferior,
        lastDate: hoy,
      );
      if (elegido == null) return;
      alElegir(instanteDeDia(elegido));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.exportacionResultado,
          style: Theme.of(context).textTheme.titleSmall,
        ),
        SizedBox(height: tokens.espacio.s),
        SelectorSegmentado<ResultadoFiltro>(
          segmentos: [
            SegmentoDeSelector(
              valor: ResultadoFiltro.todos,
              etiqueta: l10n.exportacionTodos,
            ),
            SegmentoDeSelector(
              valor: ResultadoFiltro.permitido,
              etiqueta: l10n.exportacionPermitido,
            ),
            SegmentoDeSelector(
              valor: ResultadoFiltro.rechazado,
              etiqueta: l10n.exportacionRechazado,
            ),
          ],
          seleccionado: filtros.resultado,
          alElegir: bloqueado ? (_) {} : notifier.elegirResultado,
        ),
        SizedBox(height: tokens.espacio.m),
        FilaClaveValor(
          clave: l10n.exportacionDesde,
          valor: filtros.desde == null
              ? textoSinLimite
              : formatearFecha(filtros.desde!),
          alTocar: bloqueado
              ? null
              : () => elegir(filtros.desde, notifier.elegirDesde),
          accion: filtros.desde == null || bloqueado
              ? null
              : IconButton(
                  tooltip: l10n.exportacionQuitarFecha,
                  icon: const Icon(Icons.close),
                  onPressed: () => notifier.elegirDesde(null),
                ),
        ),
        FilaClaveValor(
          clave: l10n.exportacionHasta,
          valor: filtros.hasta == null
              ? textoSinLimite
              : formatearFecha(filtros.hasta!),
          alTocar: bloqueado
              ? null
              : () => elegir(filtros.hasta, notifier.elegirHasta),
          accion: filtros.hasta == null || bloqueado
              ? null
              : IconButton(
                  tooltip: l10n.exportacionQuitarFecha,
                  icon: const Icon(Icons.close),
                  onPressed: () => notifier.elegirHasta(null),
                ),
          conSeparador: false,
        ),
      ],
    );
  }
}
