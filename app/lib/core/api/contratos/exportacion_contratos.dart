/// Una página de `GET /exportaciones/{recurso}`: el CSV tal cual llega y lo
/// que dicen sus cabeceras `X-*` (ADR 0033 §3). El CSV es texto y no se
/// guarda: la pantalla lo comparte y lo suelta.
class PaginaExportadaDto {
  const new({
    required this.csv,
    required this.pagina,
    required this.porPagina,
    required this.total,
    required this.filas,
    required this.hayMas,
    required this.truncado,
  });

  final String csv;
  final int pagina;
  final int porPagina;

  /// Filas exportables en total, ya con el tope aplicado.
  final int total;

  /// Filas de datos de esta página (sin el encabezado).
  final int filas;

  /// `true` si falta otra página.
  final bool hayMas;

  /// `true` si hay más datos que el tope y el resto no se exporta.
  final bool truncado;
}
