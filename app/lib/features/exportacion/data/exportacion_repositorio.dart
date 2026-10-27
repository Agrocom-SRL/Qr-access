import 'dart:convert';
import 'dart:typed_data';

import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Una página de la exportación de mi rama (ADR 0033 §3). Los tests lo
/// sustituyen por un fake con el shape del contrato.
abstract interface class ExportacionRepositorio {
  /// Baja UNA página. Los filtros de fecha y de resultado solo valen para las
  /// lecturas; con otro recurso no se mandan.
  Future<PaginaDeExportacion> pagina({
    required RecursoExportable recurso,
    required int pagina,
    required FiltrosDeExportacion filtros,
  });
}

class ExportacionRepositorioApi implements ExportacionRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<PaginaDeExportacion> pagina({
    required RecursoExportable recurso,
    required int pagina,
    required FiltrosDeExportacion filtros,
  }) async {
    final lecturas = recurso == RecursoExportable.lecturas;
    final dto = await _api.exportar(
      recurso: recurso.api,
      pagina: pagina,
      porPagina: porPaginaDeExportacion,
      resultado: lecturas ? filtros.resultado.api : null,
      desde: lecturas ? inicioDelRango(filtros) : null,
      hasta: lecturas ? finDelRango(filtros) : null,
    );
    return PaginaDeExportacion(
      csv: Uint8List.fromList(utf8.encode(dto.csv)),
      resumen: ResumenDePagina(
        pagina: dto.pagina,
        porPagina: dto.porPagina,
        total: dto.total,
        filas: dto.filas,
        hayMas: dto.hayMas,
        truncado: dto.truncado,
      ),
    );
  }
}

final exportacionRepositorioProvider = Provider<ExportacionRepositorio>(
  (ref) => ExportacionRepositorioApi(ref.watch(clienteApiProvider)),
);
