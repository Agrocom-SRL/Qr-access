import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_cache.dart';
import 'package:agrocom_acceso/core/plataforma/cliente_http.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/http.dart';

class _CacheVacia implements AlmacenCache {
  @override
  Future<EntradaCache?> leer(String clave) async => null;

  @override
  Future<void> guardar(String clave, String cuerpo) async {}

  @override
  Future<void> borrarTodo() async {}
}

class _AjustesFalsos implements AjustesClienteHttp {
  new(this.cabeceras);

  @override
  final Map<String, String> cabeceras;

  @override
  void aplicar(Dio dio) {}
}

class _TokensSinSesion implements ProveedorTokens {
  @override
  String? get acceso => null;

  @override
  Future<bool> renovar() async => false;
}

/// Un contenedor con el cliente HTTP real (`dioProvider`) y los ajustes de
/// plataforma que el test elige. El adaptador de red responde 200 y guarda
/// las peticiones para mirar sus cabeceras.
({ProviderContainer contenedor, AdaptadorHttpFalso red}) _armar(
  Map<String, String> cabeceras,
) {
  final red = AdaptadorHttpFalso((_) async => respuestaJson(200, {}));
  final contenedor = ProviderContainer(
    overrides: [
      ajustesClienteHttpProvider.overrideWithValue(_AjustesFalsos(cabeceras)),
      almacenCacheProvider.overrideWithValue(_CacheVacia()),
      proveedorTokensProvider.overrideWithValue(_TokensSinSesion()),
    ],
  );
  contenedor.read(dioProvider).httpClientAdapter = red;
  return (contenedor: contenedor, red: red);
}

void main() {
  test('con los ajustes de web, anuncia la app en cada petición', () async {
    final (:contenedor, :red) = _armar({'X-Requested-With': 'agrocom-app'});
    addTearDown(contenedor.dispose);

    await contenedor.read(dioProvider).get<void>('/sesiones/actual');

    expect(red.peticiones.single.headers['X-Requested-With'], 'agrocom-app');
  });

  test('con los ajustes de móvil, no envía la cabecera de navegador', () async {
    final (:contenedor, :red) = _armar(const {});
    addTearDown(contenedor.dispose);

    await contenedor.read(dioProvider).get<void>('/sesiones/actual');

    expect(
      red.peticiones.single.headers.containsKey('X-Requested-With'),
      isFalse,
    );
    expect(red.peticiones.single.headers['Accept'], 'application/json');
  });
}
