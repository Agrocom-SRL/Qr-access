import 'package:agrocom_acceso/features/puertas/data/puertas_repositorio.dart';
import 'package:agrocom_acceso/features/puertas/domain/puerta.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Puertas que el usuario puede elegir al emitir un QR (HU-11).
final puertasDisponiblesProvider = FutureProvider<List<Puerta>>(
  (ref) => ref.watch(puertasRepositorioProvider).listarTodas(),
);
