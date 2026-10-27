import 'package:agrocom_acceso/core/l10n/idioma_controlador.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Nombre automático de este aparato: lo manda la app al iniciar sesión (campo
/// `dispositivo` de `POST /sesiones`) para que la persona reconozca cada sesión
/// en su lista de dispositivos conectados. No le pide nada: sale de la
/// plataforma. Toda la lógica vive aquí, en un solo sitio, para probarla sin
/// red ni pantalla.

/// Aparato que la app sabe nombrar. `desconocido` cubre el resto de
/// plataformas.
enum AparatoDeSesion {
  iphone,
  ipad,
  android,
  mac,
  windows,
  linux,
  navegadorWeb,
  desconocido,
}

/// El aparato según la plataforma. [web] gana sobre [plataforma]: la app web
/// corre en un navegador aunque el sistema que lo aloje sea otro.
///
/// En iOS distingue iPad de iPhone con el lado corto de la pantalla (el mismo
/// corte de tableta del tema). Sin dato, cae en iPhone, que es lo más común.
AparatoDeSesion aparatoDe({
  required bool web,
  required TargetPlatform plataforma,
  double? ladoCortoLogico,
}) {
  if (web) return AparatoDeSesion.navegadorWeb;
  return switch (plataforma) {
    TargetPlatform.android => AparatoDeSesion.android,
    TargetPlatform.iOS =>
      ladoCortoLogico != null &&
              ladoCortoLogico >= const Breakpoints().ladoCorto
          ? AparatoDeSesion.ipad
          : AparatoDeSesion.iphone,
    TargetPlatform.macOS => AparatoDeSesion.mac,
    TargetPlatform.windows => AparatoDeSesion.windows,
    TargetPlatform.linux => AparatoDeSesion.linux,
    TargetPlatform.fuchsia => AparatoDeSesion.desconocido,
  };
}

/// El texto que se manda como nombre. Las marcas son nombres propios y no se
/// traducen; "Navegador web" y el valor neutro sí van al ARB (invariante 12).
String nombreDeAparato(AparatoDeSesion aparato, AppLocalizations textos) {
  return switch (aparato) {
    AparatoDeSesion.iphone => 'iPhone',
    AparatoDeSesion.ipad => 'iPad',
    AparatoDeSesion.android => 'Android',
    AparatoDeSesion.mac => 'Mac',
    AparatoDeSesion.windows => 'Windows',
    AparatoDeSesion.linux => 'Linux',
    AparatoDeSesion.navegadorWeb => textos.dispositivoNombreNavegadorWeb,
    AparatoDeSesion.desconocido => textos.dispositivoNombreOtro,
  };
}

/// Entrega el nombre de este aparato al iniciar sesión. El aparato y los textos
/// se inyectan: los tests pasan los suyos, la app los toma del dispositivo.
class ProveedorNombreDeDispositivo {
  const new(this._aparato, this._textos);

  final AparatoDeSesion Function() _aparato;
  final AppLocalizations Function() _textos;

  String leer() => nombreDeAparato(_aparato(), _textos());
}

/// Lado corto de la pantalla en píxeles lógicos, sin contexto de UI. `null` si
/// la plataforma todavía no tiene vista.
double? _ladoCortoLogico() {
  final vista = PlatformDispatcher.instance.implicitView;
  if (vista == null) return null;
  return vista.physicalSize.shortestSide / vista.devicePixelRatio;
}

/// Nombre de este aparato. Los textos siguen el idioma elegido en Perfil o, si
/// no hay, el del dispositivo.
final nombreDeDispositivoProvider = Provider<ProveedorNombreDeDispositivo>(
  (ref) => ProveedorNombreDeDispositivo(
    () => aparatoDe(
      web: kIsWeb,
      plataforma: defaultTargetPlatform,
      ladoCortoLogico: _ladoCortoLogico(),
    ),
    () => lookupAppLocalizations(
      resolverLocale(
        ref.read(idiomaProvider),
        PlatformDispatcher.instance.locales,
      ),
    ),
  ),
);
