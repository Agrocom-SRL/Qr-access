import 'dart:async';

import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/textos_de_documento.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/widgets/hoja_de_formatos.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Pide el formato en la hoja y baja la parte que sigue de [recurso] en ese
/// formato. Lo usan las tarjetas de Exportar datos y el botón de Exportar
/// accesos. Si la persona cierra la hoja sin elegir, no pasa nada.
Future<void> bajarConFormato(
  BuildContext context,
  WidgetRef ref,
  RecursoExportable recurso,
) async {
  final formato = await elegirFormatoDeDescarga(context);
  if (formato == null || !context.mounted) return;

  final notifier = ref.read(exportacionControladorProvider.notifier);
  if (ref.read(exportacionControladorProvider).recurso != recurso) {
    notifier.elegirRecurso(recurso);
  }
  final l10n = context.l10n;
  final instante = ref.read(relojProvider)();
  await notifier.descargarSiguiente(
    formato: formato,
    textosDe: (resumen) => textosDeDocumento(
      l10n: l10n,
      recurso: recurso,
      instante: instante,
      resumen: resumen,
    ),
  );
}
