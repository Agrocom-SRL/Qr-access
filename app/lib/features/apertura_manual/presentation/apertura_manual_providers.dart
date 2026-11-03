import 'package:agrocom_acceso/features/apertura_manual/data/apertura_manual_repositorio.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Las puertas que la API deja ver a esta persona para la apertura manual.
/// Se descarta al salir de la pantalla: al volver se pide de nuevo, porque el
/// administrador pudo apagarla o una placa dejar de reportar.
final FutureProvider<List<PuertaAbrible>> puertasAbriblesProvider =
    FutureProvider.autoDispose<List<PuertaAbrible>>(
      (ref) => ref.watch(aperturaManualRepositorioProvider).puertas(),
    );
