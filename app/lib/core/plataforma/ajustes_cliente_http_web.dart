import 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_contrato.dart';
import 'package:dio/browser.dart';
import 'package:dio/dio.dart';

/// Ajustes de la app web (ADR 0033 §5).
///
/// La cabecera `X-Requested-With` es la que la API exige para entregar el
/// refresco en cookie: una página ajena no puede enviarla sin un permiso CORS
/// que la API no da. La app nativa no la envía y sigue recibiendo el refresco
/// en el cuerpo.
///
/// `withCredentials` deja que el navegador adjunte la cookie también en
/// peticiones entre orígenes (p. ej. desarrollo, con la app y la API en
/// puertos distintos). En producción la app va bajo el mismo dominio y es un
/// no-op. Se cambia el adaptador por uno igual con esa opción, porque el
/// adaptador por defecto no la permite fijar.
class AjustesClienteHttpWeb implements AjustesClienteHttp {
  @override
  Map<String, String> get cabeceras => const {
    cabeceraDeLaAppWeb: valorDeLaAppWeb,
  };

  @override
  void aplicar(Dio dio) {
    dio.httpClientAdapter = BrowserHttpClientAdapter(withCredentials: true);
  }
}

/// Fábrica que elige `cliente_http.dart` por importación condicional.
AjustesClienteHttp crearAjustesClienteHttp() => AjustesClienteHttpWeb();
