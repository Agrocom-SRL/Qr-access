import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Indicación del inicio de que se puede abrir una puerta desde la app sin
/// pasar por la lectura del QR (ADR 0035). Todos los roles de la cuenta la
/// tienen; sin el permiso no se muestra y no deja hueco.
class AvisoAbrirPuerta extends StatelessWidget {
  const new({required this.sesion, super.key});

  final SesionAutenticada sesion;

  @override
  Widget build(BuildContext context) {
    if (!sesion.tiene(Permisos.abrirPuertaManual)) {
      return const SizedBox.shrink();
    }
    final l10n = context.l10n;
    return TarjetaFila(
      titulo: l10n.inicioAbrirPuertaTitulo,
      subtitulo: l10n.inicioAbrirPuertaAyuda,
      inicio: const CajaIcono(icono: Icons.lock_open),
      alTocar: () => context.go(Rutas.abrirPuerta),
    );
  }
}
