import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Filtro del listado de QR: estado y página que se ven. Inmutable.
@immutable
class FiltroQr {
  const new({this.estado = EstadoQr.vigente, this.pagina = 1});

  final EstadoQr estado;
  final int pagina;
}

/// Estado elegido en la barra de filtros. Cambiar de estado vuelve a la
/// página 1.
class FiltroQrControlador extends Notifier<FiltroQr> {
  @override
  FiltroQr build() => const FiltroQr();

  void elegirEstado(EstadoQr estado) => state = FiltroQr(estado: estado);

  void irAPagina(int pagina) =>
      state = FiltroQr(estado: state.estado, pagina: pagina);
}

final NotifierProvider<FiltroQrControlador, FiltroQr> filtroQrProvider =
    NotifierProvider.autoDispose<FiltroQrControlador, FiltroQr>(
      FiltroQrControlador.new,
    );

/// Listado de QR según el filtro. Al anular o cambiar un QR se invalida.
final FutureProvider<Pagina<QrAcceso>> listadoQrProvider =
    FutureProvider.autoDispose<Pagina<QrAcceso>>((ref) {
      final filtro = ref.watch(filtroQrProvider);
      return ref
          .watch(qrAccesosRepositorioProvider)
          .listar(
            estado: filtro.estado,
            pagina: filtro.pagina,
            porPagina: porPaginaPorDefecto,
          );
    });

/// Anula un QR vigente (HU-13). El estado es si hay una anulación en curso.
/// El error de la API se devuelve en lugar de lanzarlo: la pantalla decide
/// cómo mostrarlo.
class AnularQrControlador extends Notifier<bool> {
  @override
  bool build() => false;

  Future<ErrorApi?> anular(String id) async {
    state = true;
    try {
      await ref.read(qrAccesosRepositorioProvider).anular(id);
      ref.invalidate(listadoQrProvider);
      return null;
    } on ErrorApi catch (error) {
      return error;
    } finally {
      state = false;
    }
  }
}

final NotifierProvider<AnularQrControlador, bool> anularQrControladorProvider =
    NotifierProvider.autoDispose<AnularQrControlador, bool>(
      AnularQrControlador.new,
    );
