import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Versión instalada de la app, tal como la declara el `pubspec.yaml`
/// (`1.0.6+11` → versión `1.0.6`, compilación `11`).
class InfoApp {
  const new({required this.version, required this.compilacion});

  final String version;
  final String compilacion;

  /// `1.0.6 (11)`, o solo la versión si la plataforma no informa compilación.
  String get completa =>
      compilacion.isEmpty ? version : '$version ($compilacion)';
}

/// Lee la versión del paquete instalado. Si la plataforma no la entrega (un
/// test sin plugin, por ejemplo), devuelve `null` y quien la muestra la omite:
/// la versión es informativa y nunca debe romper una pantalla.
final FutureProvider<InfoApp?> infoAppProvider = FutureProvider<InfoApp?>((
  ref,
) async {
  try {
    final info = await PackageInfo.fromPlatform();
    return InfoApp(version: info.version, compilacion: info.buildNumber);
  } on Object {
    return null;
  }
});
