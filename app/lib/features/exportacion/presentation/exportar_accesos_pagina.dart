import 'dart:async';

import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/avisos_de_descarga.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/descarga_de_formato.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/widgets/menu_de_fechas.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/widgets/resultados_de_lecturas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_ilustracion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/chip_etiqueta.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Bajar los accesos a puertas en PDF o Excel, con su resultado (Todos,
/// Permitido o Rechazado) y sus fechas. Es una pantalla de tercer nivel
/// (Perfil → Exportar datos → Accesos), así que su salida es la X: cierra y
/// vuelve a Exportar datos.
///
/// La descarga y las fechas son botones de la barra superior; el rango elegido
/// se ve en un chip. La pantalla es un estado vacío con su ilustración: en
/// horizontal de teléfono, las pestañas van a la izquierda y la ilustración a
/// la derecha.
class ExportarAccesosPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(exportacionControladorProvider);
    final notifier = ref.read(exportacionControladorProvider.notifier);

    final ultimo = estado.recurso == RecursoExportable.lecturas
        ? estado.ultimo
        : null;
    final puedeBajar = !estado.descargando && rangoValido(estado.filtros);
    final descarga = _BotonDeDescarga(
      tooltip: estado.descargando
          ? l10n.exportacionDescargando
          : _textoDeLaDescarga(l10n, ultimo),
      cargando: estado.descargando,
      alTocar: puedeBajar
          ? () => unawaited(
              bajarConFormato(context, ref, RecursoExportable.lecturas),
            )
          : null,
    );
    // El resultado de la descarga se queda a la vista, bajo las pestañas: un
    // SnackBar la taparía justo cuando hay que tocar para seguir bajando.
    // Teléfono en horizontal y pantalla ancha: pestañas a la izquierda y la
    // ilustración a la derecha.
    final apaisada = context.esAlturaCorta || context.esExpandida;
    final contenido = _Contenido(
      estado: estado,
      ultimo: ultimo,
      alElegirResultado: notifier.elegirResultado,
      conIlustracion: !apaisada,
    );

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.exportacionAccesosTitulo,
      rutaAtras: Rutas.exportar,
      salida: SalidaDeCabecera.cerrar,
      alSalir: () => context.go(Rutas.exportar),
      accion: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          descarga,
          _BotonDeFechas(
            hayFechas:
                estado.filtros.desde != null || estado.filtros.hasta != null,
            // Con una descarga en curso, las fechas no se cambian.
            alTocar: estado.descargando
                ? null
                : () => unawaited(mostrarMenuDeFechas(context)),
          ),
        ],
      ),
      anchoMaximo: apaisada
          ? tokens.tamano.maxContenido
          : tokens.tamano.maxFormularioSecciones,
      conRelleno: false,
      child: apaisada
          // Horizontal: las pestañas y su explicación a la izquierda y, a la
          // derecha, la ilustración de vacío con su título.
          ? Padding(
              padding: EdgeInsets.fromLTRB(
                tokens.espacio.l,
                tokens.espacio.s,
                tokens.espacio.l,
                tokens.espacio.l,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: contenido),
                  SizedBox(width: tokens.espacio.l),
                  SizedBox(
                    width: tokens.tamano.columnaApaisada,
                    child: const _VacioLateral(),
                  ),
                ],
              ),
            )
          : contenido,
    );
  }
}

/// El texto de la descarga según lo que ya se bajó: la primera parte, la que
/// sigue o volver a empezar al terminar. Va como tooltip del botón de la barra.
String _textoDeLaDescarga(AppLocalizations l10n, ResumenDePagina? ultimo) {
  if (ultimo == null) return l10n.exportacionDescargar;
  if (ultimo.hayMas) {
    return l10n.exportacionSiguiente(ultimo.pagina + 1, ultimo.paginas);
  }
  return l10n.exportacionDescargarDeNuevo;
}

/// El botón de descarga de la barra superior. Mientras baja, muestra el
/// progreso en su lugar; sin un rango válido, queda apagado.
class _BotonDeDescarga extends StatelessWidget {
  const new({
    required this.tooltip,
    required this.cargando,
    required this.alTocar,
  });

  final String tooltip;
  final bool cargando;

  /// `null` deja el botón apagado.
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return IconButton(
      tooltip: tooltip,
      onPressed: alTocar,
      icon: cargando
          ? SizedBox.square(
              dimension: tokens.tamano.iconoNav,
              child: const CircularProgressIndicator(),
            )
          : const Icon(Icons.download_outlined),
    );
  }
}

/// El botón de fechas de la barra superior. Con un rango elegido, lleva un
/// punto para que se note sin leerlo.
class _BotonDeFechas extends StatelessWidget {
  const new({required this.hayFechas, required this.alTocar});

  final bool hayFechas;

  /// `null` deja el botón apagado (hay una descarga en curso).
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return Badge(
      isLabelVisible: hayFechas,
      backgroundColor: tokens.colores.primario,
      child: IconButton(
        tooltip: l10n.exportacionFechasTooltip,
        onPressed: alTocar,
        icon: const Icon(Icons.calendar_month_outlined),
      ),
    );
  }
}

/// La parte de la pantalla que se elige: el rango (si hay), las pestañas de
/// resultado y, debajo, lo que dijo la última descarga (el resultado, el tope
/// o el error). Se queda a la vista hasta la siguiente descarga o cambio.
class _Contenido extends StatelessWidget {
  const new({
    required this.estado,
    required this.ultimo,
    required this.alElegirResultado,
    required this.conIlustracion,
  });

  final EstadoExportacion estado;
  final ResumenDePagina? ultimo;
  final ValueChanged<ResultadoFiltro> alElegirResultado;
  final bool conIlustracion;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final rango = textoDelRango(l10n, estado.filtros);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (rango != null)
          Padding(
            padding: EdgeInsets.fromLTRB(
              tokens.espacio.l,
              tokens.espacio.l,
              tokens.espacio.l,
              0,
            ),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: ChipEtiqueta(texto: rango),
            ),
          ),
        Expanded(
          child: ResultadosDeLecturas(
            seleccionado: estado.filtros.resultado,
            bloqueado: estado.descargando,
            alElegir: alElegirResultado,
            conIlustracion: conIlustracion,
          ),
        ),
        // Los avisos se desplazan si la pantalla es baja (horizontal de
        // teléfono), en lugar de desbordar.
        ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.3,
          ),
          child: _Avisos(estado: estado, ultimo: ultimo),
        ),
      ],
    );
  }
}

/// La ilustración de vacío con su título, en la columna derecha del teléfono
/// en horizontal. Se desplaza si el alto no alcanza.
class _VacioLateral extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Center(
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AccesoIlustracion(
              ruta: Multimedia.vacioEventos,
              lado: tokens.tamano.ilustracionColumna,
            ),
            SizedBox(height: tokens.espacio.s),
            Text(
              context.l10n.exportacionEleccionTitulo,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ],
        ),
      ),
    );
  }
}

/// Lo que la pantalla dice tras una descarga: el rango inválido, el error
/// traducido o el resumen de lo bajado.
class _Avisos extends StatelessWidget {
  const new({required this.estado, required this.ultimo});

  final EstadoExportacion estado;
  final ResumenDePagina? ultimo;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final error = estado.recurso == RecursoExportable.lecturas
        ? estado.error
        : null;
    final resumen = ultimo;
    final avisos = [
      if (!rangoValido(estado.filtros))
        AccesoAviso(texto: l10n.exportacionRangoInvalido),
      if (error != null)
        AccesoAviso(tono: TonoAviso.peligro, texto: textoDeError(l10n, error)),
      if (resumen != null)
        AccesoAviso(
          tono: resumen.truncado
              ? TonoAviso.advertencia
              : TonoAviso.informacion,
          texto: textoDelResumen(l10n, resumen),
        ),
    ];
    if (avisos.isEmpty) return const SizedBox.shrink();
    // Mide lo que dicen los avisos (y se desplaza solo si no caben), en vez de
    // ocupar todo el alto que le den.
    return ListView(
      shrinkWrap: true,
      padding: EdgeInsets.all(tokens.espacio.l),
      children: [
        for (var i = 0; i < avisos.length; i++) ...[
          if (i > 0) SizedBox(height: tokens.espacio.m),
          avisos[i],
        ],
      ],
    );
  }
}
