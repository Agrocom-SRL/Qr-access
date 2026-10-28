import 'package:agrocom_acceso/core/plataforma/ajustes_cliente_http_contrato.dart';
import 'package:dio/dio.dart';

/// Ajustes de la app nativa (Android e iOS): ninguno. No se anuncia como
/// cliente de navegador, así que la API le entrega el refresco en el cuerpo
/// (ADR 0033 §5). El adaptador de red es el del sistema, sin cambios.
class AjustesClienteHttpMovil implements AjustesClienteHttp {
  @override
  Map<String, String> get cabeceras => const {};

  @override
  void aplicar(Dio dio) {}
}

/// Fábrica que elige `cliente_http.dart` por importación condicional.
AjustesClienteHttp crearAjustesClienteHttp() => AjustesClienteHttpMovil();
