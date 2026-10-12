import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Rutas de los assets multimedia (créditos y licencias en
/// `docs/CREDITOS.md`). Genéricos a propósito: sirven igual para un edificio,
/// un parqueo, un condominio o una hacienda.
abstract final class Multimedia {
  static const fotoBienvenida = 'assets/imagenes/bienvenida_edificio.jpg';
  static const fotoIngreso = 'assets/imagenes/ingreso_acceso.jpg';
  static const logoPlaca = 'assets/logo/logo_placa.png';
  static const fondoSplash = 'assets/logo/fondo_splash.png';
  static const fondoSplashOscuro = 'assets/logo/fondo_splash_oscuro.png';

  static const lottieSplash = 'assets/lottie/splash_logo.json';
  static const lottieQrEmitido = 'assets/lottie/qr_emitido.json';

  static const vacioQr = 'assets/ilustraciones/vacio_qr.svg';
  static const vacioEventos = 'assets/ilustraciones/vacio_eventos.svg';
  static const vacioPuertas = 'assets/ilustraciones/vacio_puertas.svg';
  static const error = 'assets/ilustraciones/error.svg';
  static const sinConexion = 'assets/ilustraciones/sin_conexion.svg';
  static const bloqueo = 'assets/ilustraciones/bloqueo.svg';

  static const List<String> ilustraciones = [
    vacioQr,
    vacioEventos,
    vacioPuertas,
    error,
    sinConexion,
    bloqueo,
  ];

  /// Deja las ilustraciones ya parseadas en la caché de `flutter_svg` para
  /// que el primer estado vacío no parpadee. Un fallo no debe impedir arrancar.
  static Future<void> precachearIlustraciones([AssetBundle? bundle]) async {
    for (final ruta in ilustraciones) {
      final cargador = SvgAssetLoader(ruta, assetBundle: bundle);
      try {
        await svg.cache.putIfAbsent(
          cargador.cacheKey(null),
          () => cargador.loadBytes(null),
        );
      } on Object {
        // Se cargará bajo demanda.
      }
    }
  }
}
