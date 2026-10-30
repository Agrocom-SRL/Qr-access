import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Menú de tres puntos de Perfil: lleva a las páginas de las funciones que no
/// son de todos. Cada opción sale de su permiso (la API decide el alcance), así
/// que el Administrador ve todas, el Titular las suyas y el Guardia o el
/// usuario final, solo Ajustes.
class MenuPerfil extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final sesion = ref.watch(sesionControladorProvider);
    final opciones = <({String ruta, IconData icono, String texto})>[
      (
        ruta: Rutas.ajustes,
        icono: Icons.settings_outlined,
        texto: l10n.perfilAjustes,
      ),
      if (sesion.tiene(Permisos.verIncidentes))
        (
          ruta: Rutas.incidentes,
          icono: Icons.report_outlined,
          texto: l10n.perfilIncidentes,
        ),
      if (sesion.tiene(Permisos.configurarAperturaManual))
        (
          ruta: Rutas.aperturaManual,
          icono: Icons.lock_open,
          texto: l10n.perfilAperturaManual,
        ),
      if (sesion.tiene(Permisos.anularQrDeRama) ||
          sesion.tiene(Permisos.exportarDatos))
        (
          ruta: Rutas.seguridad,
          icono: Icons.shield_outlined,
          texto: l10n.perfilSeguridadTitulo,
        ),
    ];
    return PopupMenuButton<String>(
      tooltip: l10n.perfilMenuMas,
      icon: const Icon(Icons.more_vert),
      onSelected: context.go,
      itemBuilder: (_) => [
        for (final o in opciones)
          PopupMenuItem<String>(
            value: o.ruta,
            child: Row(
              children: [
                Icon(o.icono),
                SizedBox(width: context.tokens.espacio.m),
                Flexible(child: Text(o.texto)),
              ],
            ),
          ),
      ],
    );
  }
}
