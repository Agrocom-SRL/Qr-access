import 'package:agrocom_acceso/core/plataforma/almacen_pin_contrato.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Implementación móvil: el PIN va al almacén seguro del sistema (Keystore
/// en Android, Keychain en iOS), nunca a un archivo en claro ni a las
/// preferencias.
class AlmacenPinMovil implements AlmacenPin {
  new([FlutterSecureStorage? almacen])
    : _almacen = almacen ?? const FlutterSecureStorage();

  static const _clave = 'sesion.pin';

  final FlutterSecureStorage _almacen;

  @override
  bool get disponible => true;

  @override
  Future<String?> leer() => _almacen.read(key: _clave);

  @override
  Future<void> guardar(String pin) => _almacen.write(key: _clave, value: pin);

  @override
  Future<void> borrar() => _almacen.delete(key: _clave);
}

/// Fábrica que elige `almacen_pin.dart` por importación condicional.
AlmacenPin crearAlmacenPin() => AlmacenPinMovil();
