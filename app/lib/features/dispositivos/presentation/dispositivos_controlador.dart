import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/dispositivos/data/sesiones_repositorio.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mis sesiones, ya ordenadas (la de este aparato primero). Se invalida al
/// cerrar alguna.
final FutureProvider<Pagina<SesionConectada>> misSesionesProvider =
    FutureProvider.autoDispose<Pagina<SesionConectada>>((ref) async {
      final pagina = await ref.watch(sesionesRepositorioProvider).listar();
      return Pagina(
        datos: ordenarSesiones(pagina.datos),
        pagina: pagina.pagina,
        porPagina: pagina.porPagina,
        total: pagina.total,
      );
    });

/// Resultado de cerrar: cuántas sesiones se cerraron, o el error de la API
/// para que la pantalla lo traduzca. No se lanza.
@immutable
class ResultadoCierre {
  const new({this.cerradas = 0, this.error});

  final int cerradas;
  final ErrorApi? error;
}

/// Cierra sesiones propias. El estado es si hay un cierre en curso, para que
/// el botón no se pulse dos veces.
class CierreDeSesionesControlador extends Notifier<bool> {
  @override
  bool build() => false;

  /// Cierra una sesión. Vuelve a pedir la lista pase lo que pase: si ya estaba
  /// cerrada, la lista tiene que dejar de mostrarla.
  Future<ResultadoCierre> cerrar(String id) async {
    state = true;
    try {
      await ref.read(sesionesRepositorioProvider).cerrar(id);
      return const ResultadoCierre(cerradas: 1);
    } on ErrorApi catch (error) {
      return ResultadoCierre(error: error);
    } finally {
      ref.invalidate(misSesionesProvider);
      state = false;
    }
  }

  Future<ResultadoCierre> cerrarOtras() async {
    state = true;
    try {
      final cerradas = await ref
          .read(sesionesRepositorioProvider)
          .cerrarOtras();
      return ResultadoCierre(cerradas: cerradas);
    } on ErrorApi catch (error) {
      return ResultadoCierre(error: error);
    } finally {
      ref.invalidate(misSesionesProvider);
      state = false;
    }
  }
}

final NotifierProvider<CierreDeSesionesControlador, bool>
cierreDeSesionesProvider =
    NotifierProvider.autoDispose<CierreDeSesionesControlador, bool>(
      CierreDeSesionesControlador.new,
    );
