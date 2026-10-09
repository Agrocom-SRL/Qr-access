import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferencias no sensibles de la persona (el tema elegido). Lo sensible
/// (el refresco de la sesión) nunca va acá: eso es `AlmacenRefresco`.
abstract interface class AlmacenPreferencias {
  Future<String?> leer(String clave);
  Future<void> guardar(String clave, String valor);
  Future<void> borrar(String clave);
}

/// Implementación con `shared_preferences`, igual en Android, iOS y web.
class PreferenciasDelDispositivo implements AlmacenPreferencias {
  const new();

  @override
  Future<String?> leer(String clave) async =>
      (await SharedPreferences.getInstance()).getString(clave);

  @override
  Future<void> guardar(String clave, String valor) async {
    final preferencias = await SharedPreferences.getInstance();
    await preferencias.setString(clave, valor);
  }

  @override
  Future<void> borrar(String clave) async {
    final preferencias = await SharedPreferences.getInstance();
    await preferencias.remove(clave);
  }
}

final almacenPreferenciasProvider = Provider<AlmacenPreferencias>(
  (ref) => const PreferenciasDelDispositivo(),
);
