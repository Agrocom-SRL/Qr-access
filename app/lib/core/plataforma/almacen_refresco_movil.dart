import 'package:agrocom_acceso/core/plataforma/almacen_refresco_contrato.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Implementación móvil: el refresco va al almacén seguro del sistema
/// (Keystore en Android, Keychain en iOS), nunca a un archivo en claro.
class AlmacenRefrescoMovil implements AlmacenRefresco {
  new([FlutterSecureStorage? almacen])
    : _almacen = almacen ?? const FlutterSecureStorage();

  static const _clave = 'sesion.refresco';

  final FlutterSecureStorage _almacen;

  @override
  Future<String?> leer() => _almacen.read(key: _clave);

  @override
  Future<void> guardar(String refresco) =>
      _almacen.write(key: _clave, value: refresco);

  @override
  Future<void> borrar() => _almacen.delete(key: _clave);
}

/// Fábrica que elige `almacen_refresco.dart` por importación condicional.
AlmacenRefresco crearAlmacenRefresco() => AlmacenRefrescoMovil();
