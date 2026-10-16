import 'dart:async';
import 'dart:ui';

import 'package:agrocom_acceso/core/l10n/idioma.dart';
import 'package:agrocom_acceso/core/plataforma/preferencias.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Clave con la que se guarda el idioma elegido.
const clavePreferenciaIdioma = 'idioma';

/// Idioma elegido en Perfil. `null` mientras la persona no elija uno: la app
/// sigue al dispositivo (o usa [idiomaPorDefecto] si no lo tiene). Recuerda
/// lo elegido, igual que el tema.
class IdiomaControlador extends Notifier<Idioma?> {
  @override
  Idioma? build() {
    unawaited(_restaurar());
    return null;
  }

  Future<void> _restaurar() async {
    final guardado = await ref
        .read(almacenPreferenciasProvider)
        .leer(clavePreferenciaIdioma);
    final idioma = Idioma.deCodigo(guardado);
    if (idioma != null) state = idioma;
  }

  /// Elige un idioma, o vuelve al del dispositivo con `null`.
  Future<void> elegir(Idioma? idioma) async {
    state = idioma;
    final almacen = ref.read(almacenPreferenciasProvider);
    if (idioma == null) {
      await almacen.borrar(clavePreferenciaIdioma);
    } else {
      await almacen.guardar(clavePreferenciaIdioma, idioma.codigo);
    }
  }
}

final NotifierProvider<IdiomaControlador, Idioma?> idiomaProvider =
    NotifierProvider<IdiomaControlador, Idioma?>(IdiomaControlador.new);

/// El `Locale` que debe usar la app: el elegido o, si no hay, el del
/// dispositivo cuando la app lo tiene, y si no, [idiomaPorDefecto].
Locale resolverLocale(Idioma? elegido, List<Locale>? delDispositivo) {
  if (elegido != null) return elegido.locale;
  for (final locale in delDispositivo ?? const <Locale>[]) {
    final idioma = Idioma.deCodigo(locale.languageCode);
    if (idioma != null) return idioma.locale;
  }
  return idiomaPorDefecto.locale;
}
