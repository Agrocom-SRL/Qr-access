import 'package:agrocom_acceso/core/l10n/l10n.dart';

/// Cómo se nombra cada paso que el sistema propone ante un reincidente (ADR
/// 0033 §4.3). Lo usan los incidentes y los avisos de la bandeja; por eso vive
/// aquí y no en una feature. Un valor que la app no conoce cae en restringir,
/// el paso más leve: el aviso se lee igual sin subir la gravedad por error.
String textoDeAccionPropuesta(AppLocalizations l10n, String accion) =>
    switch (accion) {
      'suspender' => l10n.incidenteAccionSuspender,
      'suspender_y_anular' => l10n.incidenteAccionSuspenderYAnular,
      _ => l10n.incidenteAccionRestringir,
    };
