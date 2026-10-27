import 'dart:async';

import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/avisos_de_descarga.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/descarga_de_formato.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/widgets/tarjeta_recurso_exportable.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Exportar datos (ADR 0033 §3), solo para el Administrador. Es un listado
/// corto de tres tarjetas. Usuarios y Puertas abren la hoja de formatos (CSV,
/// PDF o Excel); Accesos a puertas tiene filtros y abre su propia pantalla.
class ExportacionPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(exportacionControladorProvider);
    ref.listen(
      exportacionControladorProvider,
      (antes, ahora) => avisarResultadoDescarga(context, antes, ahora),
    );

    // Con una descarga en curso, las tarjetas quedan apagadas: se baja una cosa
    // a la vez. Usuarios y Puertas piden el formato en una hoja.
    bool cargando(RecursoExportable recurso) =>
        estado.descargando && estado.recurso == recurso;

    VoidCallback? accion(RecursoExportable recurso) => estado.descargando
        ? null
        : () => unawaited(bajarConFormato(context, ref, recurso));

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.exportacionTitulo,
      rutaAtras: Rutas.perfil,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.perfil),
      anchoMaximo: tokens.tamano.maxFormularioSecciones,
      conRelleno: false,
      child: ListView(
        padding: EdgeInsets.all(tokens.espacio.l),
        children: [
          Text(
            l10n.exportacionSubtitulo,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: tokens.colores.textoSecundario),
          ),
          SizedBox(height: tokens.espacio.l),
          TarjetaRecursoExportable(
            icono: Icons.people_outline,
            titulo: l10n.exportacionRecursoUsuarios,
            descripcion: l10n.exportacionDescUsuarios,
            textoAccion: l10n.exportacionDescargar,
            iconoAccion: Icons.download_outlined,
            textoCargando: l10n.exportacionDescargando,
            cargando: cargando(RecursoExportable.usuarios),
            onPressed: accion(RecursoExportable.usuarios),
          ),
          SizedBox(height: tokens.espacio.m),
          TarjetaRecursoExportable(
            icono: Icons.door_front_door_outlined,
            titulo: l10n.exportacionRecursoPuertas,
            descripcion: l10n.exportacionDescPuertas,
            textoAccion: l10n.exportacionDescargar,
            iconoAccion: Icons.download_outlined,
            textoCargando: l10n.exportacionDescargando,
            cargando: cargando(RecursoExportable.puertas),
            onPressed: accion(RecursoExportable.puertas),
          ),
          SizedBox(height: tokens.espacio.m),
          TarjetaRecursoExportable(
            icono: Icons.history,
            titulo: l10n.exportacionRecursoLecturas,
            descripcion: l10n.exportacionDescLecturas,
            textoAccion: l10n.exportacionElegirFiltros,
            iconoAccion: Icons.tune,
            textoCargando: l10n.exportacionDescargando,
            cargando: false,
            onPressed: estado.descargando
                ? null
                : () => context.push(Rutas.exportarAccesos),
          ),
        ],
      ),
    );
  }
}
