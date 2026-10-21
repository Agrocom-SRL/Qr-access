import 'dart:async';

import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/puertas/data/puertas_repositorio.dart';
import 'package:agrocom_acceso/features/puertas/domain/puerta.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Puertas de la cuenta, para elegir al generar un QR (HU-11) y para el
/// tablero y la administración (HU-09).
///
/// Se descarta cuando nadie la mira y se vuelve a pedir cada 15 s mientras
/// alguien la mira: así una placa que se conecta después de abrir la app
/// pasa a "En línea" sin recargar.
final FutureProvider<List<Puerta>> puertasDisponiblesProvider =
    FutureProvider.autoDispose<List<Puerta>>((ref) {
      final temporizador = Timer(
        const Duraciones().refrescoEstadoPuertas,
        ref.invalidateSelf,
      );
      ref.onDispose(temporizador.cancel);
      return ref.watch(puertasRepositorioProvider).listarTodas();
    });

/// Las puertas agrupadas por sitio, en el orden en que llegan.
Map<String, List<Puerta>> agruparPorSitio(List<Puerta> puertas) {
  final grupos = <String, List<Puerta>>{};
  for (final puerta in puertas) {
    grupos.putIfAbsent(puerta.sitioNombre, () => []).add(puerta);
  }
  return grupos;
}
