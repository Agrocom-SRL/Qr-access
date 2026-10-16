import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_cache.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:agrocom_acceso/core/config/entorno.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_cache.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Quién guarda los tokens de la sesión. Se sobrescribe en el arranque
/// (`main.dart`) con el `SesionControlador`; `core/api` no lo conoce.
final proveedorTokensProvider = Provider<ProveedorTokens>(
  (ref) => throw UnimplementedError(
    'proveedorTokensProvider debe sobrescribirse en el arranque',
  ),
);

/// Quién consulta, para separar la caché del modo sin conexión por usuario y
/// rol. Se sobrescribe en el arranque con la sesión; sin sesión no se guarda.
final ambitoCacheProvider = Provider<AmbitoDeCache>(
  (ref) =>
      () => null,
);

/// Hora de los datos guardados que se están mostrando porque no hay conexión;
/// `null` cuando lo que se ve es lo último que respondió el servidor.
class DatosGuardados extends Notifier<DateTime?> {
  @override
  DateTime? build() => null;

  // ignore: use_setters_to_change_properties, se pasa como callback al interceptor
  void mostrar(DateTime guardadoAt) => state = guardadoAt;

  void descartar() => state = null;
}

final NotifierProvider<DatosGuardados, DateTime?> datosGuardadosProvider =
    NotifierProvider<DatosGuardados, DateTime?>(DatosGuardados.new);

/// Cliente HTTP con la base `…/api/v1`, el JWT y la renovación de sesión.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: '${Entorno.apiUrl}/api/${Entorno.versionApi}',
      connectTimeout: const Duration(seconds: Entorno.tiempoEsperaSegundos),
      receiveTimeout: const Duration(seconds: Entorno.tiempoEsperaSegundos),
      headers: {'Accept': 'application/json'},
    ),
  );
  dio.interceptors.add(
    InterceptorSesion(ref.watch(proveedorTokensProvider), dio),
  );
  final datos = ref.read(datosGuardadosProvider.notifier);
  dio.interceptors.add(
    InterceptorCache(
      ref.watch(almacenCacheProvider),
      ref.watch(ambitoCacheProvider),
      alServirGuardado: datos.mostrar,
      alRecibirDatosVivos: datos.descartar,
    ),
  );
  return dio;
});

/// Endpoints de la API V1 tipados (ver `ClienteApi`).
final clienteApiProvider = Provider<ClienteApi>(
  (ref) => ClienteApi(ref.watch(dioProvider)),
);
