import 'package:agrocom_acceso/core/plataforma/almacen_pin_contrato.dart';

/// Implementación web: no guarda el PIN. Cualquier cosa que viva en el
/// navegador la puede leer un script ajeno (XSS) o quien use ese equipo.
class AlmacenPinWeb implements AlmacenPin {
  @override
  bool get disponible => false;

  @override
  Future<String?> leer() async => null;

  @override
  Future<void> guardar(String pin) async {
    // Intencionado: en web el PIN no se guarda.
  }

  @override
  Future<void> borrar() async {}
}

/// Fábrica que elige `almacen_pin.dart` por importación condicional.
AlmacenPin crearAlmacenPin() => AlmacenPinWeb();
