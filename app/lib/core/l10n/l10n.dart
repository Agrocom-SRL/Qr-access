import 'package:agrocom_acceso/l10n/gen/app_localizations.dart';
import 'package:flutter/widgets.dart';

export 'package:agrocom_acceso/l10n/gen/app_localizations.dart';

/// Atajo para los textos del ARB: `context.l10n.sesionBotonIngresar`
/// (ADR 0013).
extension L10nContexto on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
