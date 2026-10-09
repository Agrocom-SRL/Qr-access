import 'package:flutter/foundation.dart';

/// Una página de un listado de la API: `{ datos, meta }` (contrato común V1).
/// Las features la construyen desde sus repositorios; la UI la pinta con
/// `ListadoPaginado`.
@immutable
class Pagina<T> {
  const new({
    required this.datos,
    required this.pagina,
    required this.porPagina,
    required this.total,
  });

  final List<T> datos;

  /// Número de página, desde 1.
  final int pagina;
  final int porPagina;
  final int total;

  /// Cantidad de páginas; un listado vacío cuenta como una.
  int get totalPaginas => total == 0 ? 1 : (total + porPagina - 1) ~/ porPagina;

  bool get tieneAnterior => pagina > 1;

  bool get tieneSiguiente => pagina < totalPaginas;
}

/// Tamaño de página de los listados de la app (la API acepta hasta 100).
const porPaginaPorDefecto = 20;
