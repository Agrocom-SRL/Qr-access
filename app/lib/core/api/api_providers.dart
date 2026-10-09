import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/interceptor_sesion.dart';
import 'package:agrocom_acceso/core/config/entorno.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Quién guarda los tokens de la sesión. Se sobrescribe en el arranque
/// (`main.dart`) con el `SesionControlador`; `core/api` no lo conoce.
final proveedorTokensProvider = Provider<ProveedorTokens>(
  (ref) => throw UnimplementedError(
    'proveedorTokensProvider debe sobrescribirse en el arranque',
  ),
);

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
  return dio;
});

/// Endpoints de la API V1 tipados (ver `ClienteApi`).
final clienteApiProvider = Provider<ClienteApi>(
  (ref) => ClienteApi(ref.watch(dioProvider)),
);
