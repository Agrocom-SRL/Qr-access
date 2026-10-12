import 'package:agrocom_acceso/core/plataforma/almacen_qr_contrato.dart';

/// Implementación web: solo en memoria, como el refresco de la sesión. Al
/// recargar la pestaña los QR emitidos dejan de poder mostrarse.
class AlmacenQrWeb implements AlmacenQr {
  static final Map<String, ({String texto, DateTime venceAt})> _entradas = {};

  @override
  Future<String?> leer(String id) async {
    final entrada = _entradas[id];
    if (entrada == null) return null;
    if (!entrada.venceAt.isAfter(DateTime.now())) {
      _entradas.remove(id);
      return null;
    }
    return entrada.texto;
  }

  @override
  Future<void> guardar(String id, String texto, DateTime venceAt) async =>
      _entradas[id] = (texto: texto, venceAt: venceAt);

  @override
  Future<void> borrar(String id) async => _entradas.remove(id);
}

/// Fábrica que elige `almacen_qr.dart` por importación condicional.
AlmacenQr crearAlmacenQr() => AlmacenQrWeb();
