import 'dart:async';

import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/avisos_de_descarga.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/descarga_de_formato.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Exportar datos (ADR 0033 §3), solo para el Administrador. Es un listado
/// corto de tres tarjetas que se tocan enteras. Usuarios y Puertas abren
/// la hoja de formatos (PDF o Excel); Accesos a puertas tiene filtros y abre
/// su propia pantalla.
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

    final filas = [
      _FilaDeRecurso(
        icono: Icons.people_outline,
        titulo: l10n.exportacionRecursoUsuarios,
        descripcion: l10n.exportacionDescUsuarios,
        cargando: cargando(RecursoExportable.usuarios),
        alTocar: accion(RecursoExportable.usuarios),
      ),
      _FilaDeRecurso(
        icono: Icons.door_front_door_outlined,
        titulo: l10n.exportacionRecursoPuertas,
        descripcion: l10n.exportacionDescPuertas,
        cargando: cargando(RecursoExportable.puertas),
        alTocar: accion(RecursoExportable.puertas),
      ),
      _FilaDeRecurso(
        icono: Icons.history,
        titulo: l10n.exportacionRecursoLecturas,
        descripcion: l10n.exportacionDescLecturas,
        cargando: false,
        alTocar: estado.descargando
            ? null
            : () => context.push(Rutas.exportarAccesos),
      ),
    ];

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.exportacionTitulo,
      rutaAtras: Rutas.perfil,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.perfil),
      anchoMaximo: context.esExpandida
          ? tokens.tamano.maxContenido
          : tokens.tamano.maxFormularioSecciones,
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
          if (context.esExpandida)
            // Pantalla ancha: las tres tarjetas en una fila, del mismo alto.
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < filas.length; i++) ...[
                    if (i > 0) SizedBox(width: tokens.espacio.l),
                    Expanded(child: filas[i]),
                  ],
                ],
              ),
            )
          else
            for (var i = 0; i < filas.length; i++) ...[
              if (i > 0) SizedBox(height: tokens.espacio.m),
              filas[i],
            ],
        ],
      ),
    );
  }
}

/// Un recurso de la lista: toda la tarjeta es el botón. Usuarios y Puertas
/// abren la hoja de formatos; Accesos abre su pantalla de filtros. Mientras su
/// recurso se baja, el chevron cambia por el progreso.
class _FilaDeRecurso extends StatelessWidget {
  const new({
    required this.icono,
    required this.titulo,
    required this.descripcion,
    required this.cargando,
    required this.alTocar,
  });

  final IconData icono;
  final String titulo;
  final String descripcion;
  final bool cargando;

  /// `null` deja la tarjeta apagada (otra descarga en curso).
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return TarjetaFila(
      centrada: true,
      titulo: titulo,
      subtitulo: descripcion,
      inicio: CajaIcono(icono: icono, tamano: tokens.tamano.iconoCaja),
      fin: cargando
          ? SizedBox.square(
              dimension: tokens.tamano.iconoNav,
              child: const CircularProgressIndicator(),
            )
          : const Icon(Icons.chevron_right),
      alTocar: alTocar,
    );
  }
}
