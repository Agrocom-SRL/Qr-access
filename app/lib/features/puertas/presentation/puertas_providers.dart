import 'package:agrocom_acceso/features/puertas/data/puertas_repositorio.dart';
import 'package:agrocom_acceso/features/puertas/domain/puerta.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Puertas de la cuenta, para elegir al emitir un QR (HU-11) y para el
/// tablero y la administración (HU-09). Se invalida para refrescar.
final puertasDisponiblesProvider = FutureProvider<List<Puerta>>(
  (ref) => ref.watch(puertasRepositorioProvider).listarTodas(),
);

/// Las puertas agrupadas por sitio, en el orden en que llegan.
Map<String, List<Puerta>> agruparPorSitio(List<Puerta> puertas) {
  final grupos = <String, List<Puerta>>{};
  for (final puerta in puertas) {
    grupos.putIfAbsent(puerta.sitioNombre, () => []).add(puerta);
  }
  return grupos;
}
