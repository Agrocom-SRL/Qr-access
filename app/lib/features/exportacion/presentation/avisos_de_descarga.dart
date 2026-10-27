import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:flutter/material.dart';

/// Dice con un SnackBar lo que dejó una descarga: el error (traducido) o el
/// resultado de la parte bajada. Solo avisa de lo que cambió respecto del
/// estado anterior, así no repite un aviso al reconstruir la pantalla.
void avisarResultadoDescarga(
  BuildContext context,
  EstadoExportacion? antes,
  EstadoExportacion ahora,
) {
  final l10n = context.l10n;
  final error = ahora.error;
  final ultimo = ahora.ultimo;
  final String texto;
  if (error != null && error != antes?.error) {
    texto = textoDeError(l10n, error);
  } else if (ultimo != null && ultimo != antes?.ultimo) {
    texto = textoDelResumen(l10n, ultimo);
  } else {
    return;
  }
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
}

/// Lo que se dice de una parte bajada: el tope (si la API lo alcanzó), que no
/// hubo filas o cuántas se bajaron. Lo usan el SnackBar y el aviso de la
/// pantalla de accesos.
String textoDelResumen(AppLocalizations l10n, ResumenDePagina resumen) {
  if (resumen.truncado) return l10n.exportacionTruncado;
  if (resumen.total == 0) return l10n.exportacionSinFilas;
  return l10n.exportacionDescargada(
    resumen.pagina,
    resumen.paginas,
    resumen.filas,
  );
}
