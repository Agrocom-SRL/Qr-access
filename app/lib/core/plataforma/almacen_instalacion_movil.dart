import 'package:agrocom_acceso/core/plataforma/almacen_instalacion_contrato.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Implementación móvil: el almacén seguro del sistema (Keystore en Android,
/// Keychain en iOS), el mismo que guarda el refresco de la sesión.
class AlmacenInstalacionMovil implements AlmacenInstalacion {
  new([FlutterSecureStorage? almacen])
    : _almacen = almacen ?? const FlutterSecureStorage();

  static const _clave = 'instalacion.id';

  final FlutterSecureStorage _almacen;

  @override
  Future<String?> leer() => _almacen.read(key: _clave);

  @override
  Future<void> guardar(String instalacionId) =>
      _almacen.write(key: _clave, value: instalacionId);
}

/// Fábrica que elige `almacen_instalacion.dart` por importación condicional.
AlmacenInstalacion crearAlmacenInstalacion() => AlmacenInstalacionMovil();
