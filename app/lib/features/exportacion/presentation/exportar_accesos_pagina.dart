import 'dart:async';

import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/avisos_de_descarga.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/descarga_de_formato.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/widgets/menu_de_fechas.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/widgets/resultados_de_lecturas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/chip_etiqueta.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/formulario_secciones.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Bajar los accesos a puertas en CSV, PDF o Excel, con su resultado (Todos,
/// Permitido o Rechazado) y sus fechas. Es una pantalla de tercer nivel
/// (Perfil → Exportar datos → Accesos), así que su salida es la X: cierra y
/// vuelve a Exportar datos.
///
/// Las fechas van en un menú de la barra superior; el rango elegido se ve en
/// un chip. En horizontal de teléfono, el contenido va a la izquierda y el
/// botón a la derecha, abajo, para que nunca tape lo que se elige.
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
    final boton = AccesoBoton(
      texto: _textoDelBoton(l10n, ultimo),
      textoCargando: l10n.exportacionDescargando,
      icono: Icons.download_outlined,
      cargando: estado.descargando,
      expandido: true,
      onPressed: puedeBajar
          ? () => unawaited(
              bajarConFormato(context, ref, RecursoExportable.lecturas),
            )
          : null,
    );
    final contenido = _Contenido(
      estado: estado,
      ultimo: ultimo,
      alElegirResultado: notifier.elegirResultado,
    );
    // Aquí el resultado se queda a la vista, sobre el botón: un SnackBar la
    // taparía justo cuando hay que tocarlo para seguir bajando.
    final apaisada = context.esAlturaCorta;

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.exportacionAccesosTitulo,
      rutaAtras: Rutas.exportar,
      salida: SalidaDeCabecera.cerrar,
      alSalir: () => context.go(Rutas.exportar),
      accion: _BotonDeFechas(
        hayFechas: estado.filtros.desde != null || estado.filtros.hasta != null,
        // Con una descarga en curso, las fechas no se cambian.
        alTocar: estado.descargando
            ? null
            : () => unawaited(mostrarMenuDeFechas(context)),
      ),
      anchoMaximo: apaisada
          ? tokens.tamano.maxContenido
          : tokens.tamano.maxFormularioSecciones,
      conRelleno: false,
      child: apaisada
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
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [boton],
                    ),
                  ),
                ],
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: contenido),
                BarraDeAcciones(acciones: [boton]),
              ],
            ),
    );
  }
}

/// El texto del botón según lo que ya se bajó: la primera parte, la que sigue
/// o volver a empezar al terminar.
String _textoDelBoton(AppLocalizations l10n, ResumenDePagina? ultimo) {
  if (ultimo == null) return l10n.exportacionDescargar;
  if (ultimo.hayMas) {
    return l10n.exportacionSiguiente(ultimo.pagina + 1, ultimo.paginas);
  }
  return l10n.exportacionDescargarDeNuevo;
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
  });

  final EstadoExportacion estado;
  final ResumenDePagina? ultimo;
  final ValueChanged<ResultadoFiltro> alElegirResultado;

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
          ),
        ),
        // Los avisos se desplazan si la pantalla es baja (horizontal de
        // teléfono), en lugar de desbordar.
        Flexible(
          child: _Avisos(estado: estado, ultimo: ultimo),
        ),
      ],
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
    return SingleChildScrollView(
      padding: EdgeInsets.all(tokens.espacio.l),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < avisos.length; i++) ...[
            if (i > 0) SizedBox(height: tokens.espacio.m),
            avisos[i],
          ],
        ],
      ),
    );
  }
}
