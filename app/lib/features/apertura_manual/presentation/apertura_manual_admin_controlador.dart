import 'package:agrocom_acceso/features/apertura_manual/data/apertura_manual_repositorio.dart';
import 'package:agrocom_acceso/features/apertura_manual/presentation/apertura_manual_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Enciende o apaga la apertura manual desde la pantalla del administrador
/// (ADR 0035 §5). El estado es si hay un cambio en vuelo; al terminar se pide
/// de nuevo la lista, que es la verdad (la API decide, no la pantalla).
class AperturaManualAdminControlador extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> puerta(String puertaId, {required bool habilitada}) => _aplicar(
    (repositorio) =>
        repositorio.configurarPuerta(puertaId, habilitada: habilitada),
  );

  /// Todas las puertas y las que se registren después.
  Future<void> cuenta({required bool habilitada}) => _aplicar(
    (repositorio) => repositorio.configurarCuenta(habilitada: habilitada),
  );

  Future<void> _aplicar(
    Future<void> Function(AperturaManualRepositorio repositorio) cambio,
  ) async {
    if (state.isLoading) return;
    state = const AsyncLoading();
    final resultado = await AsyncValue.guard(
      () => cambio(ref.read(aperturaManualRepositorioProvider)),
    );
    if (!ref.mounted) return;
    state = resultado;
    ref.invalidate(puertasAbriblesProvider);
  }
}

final NotifierProvider<AperturaManualAdminControlador, AsyncValue<void>>
aperturaManualAdminProvider =
    NotifierProvider.autoDispose<
      AperturaManualAdminControlador,
      AsyncValue<void>
    >(AperturaManualAdminControlador.new);
