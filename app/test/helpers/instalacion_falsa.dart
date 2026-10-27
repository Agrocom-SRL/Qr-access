import 'package:agrocom_acceso/core/plataforma/almacen_instalacion.dart';

/// Almacén de la instalación en memoria. [errorAlLeer] simula un almacén roto.
class AlmacenInstalacionFalso implements AlmacenInstalacion {
  new([this.instalacionId]);

  String? instalacionId;
  final List<String> guardados = [];
  Exception? errorAlLeer;
  int lecturas = 0;

  @override
  Future<String?> leer() async {
    lecturas++;
    if (errorAlLeer != null) throw errorAlLeer!;
    return instalacionId;
  }

  @override
  Future<void> guardar(String instalacionId) async {
    guardados.add(instalacionId);
    this.instalacionId = instalacionId;
  }
}
