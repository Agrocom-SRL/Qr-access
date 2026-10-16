import 'package:agrocom_acceso/core/listados/pagina.dart';

/// Forma común de los listados (contrato común V1):
/// `{ datos, meta: { pagina, por_pagina, total } }`.
class PaginaDto<T> {
  const new({
    required this.datos,
    required this.pagina,
    required this.porPagina,
    required this.total,
  });

  final List<T> datos;
  final int pagina;
  final int porPagina;
  final int total;

  /// La misma página con sus datos convertidos al modelo de la feature.
  Pagina<R> aPagina<R>(R Function(T dato) convertir) => Pagina(
    datos: [for (final dato in datos) convertir(dato)],
    pagina: pagina,
    porPagina: porPagina,
    total: total,
  );
}

/// Lee un listado con `leerDato` para cada elemento de `datos`.
PaginaDto<R> paginaDeApi<R>(
  Map<String, dynamic> json,
  R Function(Map<String, dynamic> json) leerDato,
) {
  final meta = json['meta'] as Map<String, dynamic>;
  return PaginaDto<R>(
    datos: [
      for (final dato in json['datos'] as List<dynamic>)
        leerDato(dato as Map<String, dynamic>),
    ],
    pagina: meta['pagina'] as int,
    porPagina: meta['por_pagina'] as int,
    total: meta['total'] as int,
  );
}

/// Fecha ISO 8601 en UTC (`...Z`), como la envía la API (contrato común V1).
DateTime fechaDeApi(String valor) => DateTime.parse(valor);

/// Fecha opcional; `null` cuando el campo no viene o viene vacío.
DateTime? fechaDeApiOpcional(Object? valor) =>
    valor is String && valor.isNotEmpty ? DateTime.parse(valor) : null;
