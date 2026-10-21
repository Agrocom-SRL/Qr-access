import 'package:agrocom_acceso/core/plataforma/almacen_qr_contrato.dart';

/// Implementación web: solo en memoria (a diferencia del refresco de la
/// sesión). Al recargar la pestaña los QR generados dejan de poder mostrarse.
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

  static QrPropioGuardado? _ultimoPropio;

  @override
  Future<QrPropioGuardado?> leerUltimoPropio() async {
    final qr = _ultimoPropio;
    if (qr != null && !qr.venceAt.isAfter(DateTime.now())) {
      _ultimoPropio = null;
    }
    return _ultimoPropio;
  }

  @override
  Future<void> guardarUltimoPropio(QrPropioGuardado qr) async =>
      _ultimoPropio = qr;

  @override
  Future<void> borrarUltimoPropio(String id) async {
    if (_ultimoPropio?.id == id) _ultimoPropio = null;
  }
}

/// Fábrica que elige `almacen_qr.dart` por importación condicional.
AlmacenQr crearAlmacenQr() => AlmacenQrWeb();
