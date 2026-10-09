import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Tablero simple: saludo, cuenta y rol activo, y un acceso por cada función
/// que el rol activo puede usar (ADR 0004: lo que no se puede, no se muestra).
class InicioPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionControladorProvider);
    if (sesion is! SesionAutenticada) return const AccesoCargando();

    final l10n = context.l10n;
    final tokens = context.tokens;
    final texto = Theme.of(context).textTheme;
    final accesos = [
      if (sesion.tiene(Permisos.emitirQr))
        _AccesoInicio(
          icono: Icons.qr_code_2,
          titulo: l10n.inicioEmitirQr,
          ruta: Rutas.qrNuevo,
        ),
      if (sesion.tiene(Permisos.verQr))
        _AccesoInicio(
          icono: Icons.list_alt,
          titulo: l10n.inicioMisQr,
          ruta: Rutas.qrMios,
        ),
      if (sesion.tiene(Permisos.verEventos))
        _AccesoInicio(
          icono: Icons.history,
          titulo: l10n.inicioEventos,
          ruta: Rutas.eventos,
        ),
    ];

    return PlantillaPantalla(
      titulo: l10n.inicioTitulo,
      acciones: [
        IconButton(
          icon: const Icon(Icons.logout),
          tooltip: l10n.sesionCerrar,
          onPressed: () =>
              ref.read(sesionControladorProvider.notifier).cerrar(),
        ),
      ],
      child: SingleChildScrollView(
        padding: EdgeInsets.all(tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(switch (sesion.usuario.etiqueta) {
              final etiqueta? => l10n.inicioSaludo(etiqueta),
              null => l10n.inicioSaludoSinNombre,
            }, style: texto.headlineSmall),
            SizedBox(height: tokens.espacio.xs),
            Text(
              l10n.inicioCuentaYRol(
                sesion.cuenta.nombre,
                sesion.rolActivo.nombre,
              ),
              style: texto.bodyMedium?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
            ),
            SizedBox(height: tokens.espacio.xl),
            if (accesos.isEmpty)
              EstadoVacio(
                icono: Icons.lock_outline,
                titulo: l10n.inicioSinAccesos,
                ayuda: l10n.inicioSinAccesosAyuda,
              )
            else
              Wrap(
                spacing: tokens.espacio.l,
                runSpacing: tokens.espacio.l,
                children: accesos,
              ),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta que lleva a una función de la app.
class _AccesoInicio extends StatelessWidget {
  const new({required this.icono, required this.titulo, required this.ruta});

  final IconData icono;
  final String titulo;
  final String ruta;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return SizedBox(
      width: tokens.tamano.tarjetaMinima,
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(tokens.radio.m),
          onTap: () => context.go(ruta),
          child: Padding(
            padding: EdgeInsets.all(tokens.espacio.l),
            child: Row(
              children: [
                Icon(icono, size: tokens.tamano.iconoGrande),
                SizedBox(width: tokens.espacio.l),
                Expanded(
                  child: Text(
                    titulo,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
