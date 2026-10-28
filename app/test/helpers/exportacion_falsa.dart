import 'dart:typed_data';

import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';

/// Una página entregada por la API en memoria. Anota cada pedido (recurso,
/// página y filtros) para que el test compruebe qué se pidió.
class ExportacionRepositorioFalso implements ExportacionRepositorio {
  new({this.paginaEntregada, this.error});

  /// La página que devuelve; si es `null`, se devuelve una con dos filas.
  final PaginaDeExportacion? paginaEntregada;
  final Exception? error;
  final List<
    ({RecursoExportable recurso, int pagina, FiltrosDeExportacion filtros})
  >
  pedidos = [];

  @override
  Future<PaginaDeExportacion> pagina({
    required RecursoExportable recurso,
    required int pagina,
    required FiltrosDeExportacion filtros,
  }) async {
    pedidos.add((recurso: recurso, pagina: pagina, filtros: filtros));
    if (error != null) throw error!;
    return paginaEntregada ?? paginaDePrueba();
  }
}

/// Una página de prueba: `filas` filas de datos, en la página `pagina` de
/// `total` filas.
PaginaDeExportacion paginaDePrueba({
  int pagina = 1,
  int filas = 2,
  int total = 2,
  bool hayMas = false,
  bool truncado = false,
}) => PaginaDeExportacion(
  csv: Uint8List.fromList('id,etiqueta\n1,Ana\n2,Luis\n'.codeUnits),
  resumen: ResumenDePagina(
    pagina: pagina,
    porPagina: porPaginaDeExportacion,
    total: total,
    filas: filas,
    hayMas: hayMas,
    truncado: truncado,
  ),
);

/// El menú de compartir en memoria: guarda lo que se le pidió compartir y
/// responde lo que el test decide (compartido, cancelado...).
class CompartirArchivoFalso implements CompartirArchivo {
  new({this.resultado = ResultadoCompartir.compartido});

  final ResultadoCompartir resultado;
  final List<({Uint8List bytes, String nombreArchivo, String mimeType})>
  compartidos = [];

  @override
  Future<ResultadoCompartir> compartir({
    required Uint8List bytes,
    required String nombreArchivo,
    required String mimeType,
  }) async {
    compartidos.add((
      bytes: bytes,
      nombreArchivo: nombreArchivo,
      mimeType: mimeType,
    ));
    return resultado;
  }
}
