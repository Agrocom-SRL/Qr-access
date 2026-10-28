import 'package:dio/dio.dart';

/// Cabecera con la que la app web se anuncia a la API, y su valor. La API la
/// lee en `clienteWebDe` para entregar el refresco en cookie: una página ajena
/// no puede enviarla sin un permiso CORS que la API no da (ADR 0033 §5).
const cabeceraDeLaAppWeb = 'X-Requested-With';
const valorDeLaAppWeb = 'agrocom-app';

/// Lo que cada plataforma le añade al cliente HTTP de la API.
///
/// La API distingue a la app web de la nativa por una cabecera propia: el
/// refresco de la web va en una cookie y el de la app nativa en el cuerpo
/// (ADR 0033 §5). Por eso la cabecera solo existe en web.
abstract interface class AjustesClienteHttp {
  /// Cabeceras que se envían en cada petición a la API.
  Map<String, String> get cabeceras;

  /// Deja listo el adaptador de red de [dio] para esta plataforma.
  void aplicar(Dio dio);
}
