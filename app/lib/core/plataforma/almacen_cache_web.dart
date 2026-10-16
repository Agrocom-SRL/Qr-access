import 'package:agrocom_acceso/core/plataforma/almacen_cache_contrato.dart';

/// Implementación web: solo en memoria (a diferencia del refresco de la
/// sesión). Al recargar la pestaña la caché se pierde.
class AlmacenCacheWeb implements AlmacenCache {
  static final Map<String, EntradaCache> _entradas = {};

  @override
  Future<EntradaCache?> leer(String clave) async => _entradas[clave];

  @override
  Future<void> guardar(String clave, String cuerpo) async => _entradas[clave] =
      EntradaCache(cuerpo: cuerpo, guardadoAt: DateTime.now());

  @override
  Future<void> borrarTodo() async => _entradas.clear();
}

AlmacenCache crearAlmacenCache() => AlmacenCacheWeb();
