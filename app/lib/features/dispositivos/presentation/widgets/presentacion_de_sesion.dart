import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// Cómo se nombra y se dibuja la plataforma de una sesión. El valor llega de la
/// API (`android`, `ios` o `web`); lo que no conoce cae en "otro aparato".
String textoDePlataforma(AppLocalizations l10n, String? plataforma) =>
    switch (plataforma) {
      'android' => l10n.dispositivosPlataformaAndroid,
      'ios' => l10n.dispositivosPlataformaIos,
      'web' => l10n.dispositivosPlataformaWeb,
      _ => l10n.dispositivosPlataformaOtra,
    };

IconData iconoDePlataforma(String? plataforma) => switch (plataforma) {
  'android' => Icons.phone_android,
  'ios' => Icons.phone_iphone,
  'web' => Icons.language,
  _ => Icons.devices_other,
};
