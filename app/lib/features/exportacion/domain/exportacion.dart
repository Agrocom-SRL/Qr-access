import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:flutter/foundation.dart';

/// Exportación de los datos de mi rama en CSV (ADR 0033 §3). La API entrega UNA
/// página por pedido, con un tope total por recurso; la app baja las páginas de
/// a una, a pedido de quien exporta, porque cada pedido cuenta contra el límite
/// de exportaciones por minuto. Puro: no toca la red ni el archivo.

/// Los recursos que se exportan. `api` es el nombre en la ruta.
enum RecursoExportable {
  usuarios('usuarios'),
  puertas('puertas'),
  lecturas('lecturas');

  new(this.api);

  final String api;
}

/// Filtro de resultado de las lecturas. `todos` no se manda a la API.
enum ResultadoFiltro {
  todos,
  permitido,
  rechazado;

  /// El valor que se manda, o `null` si no se filtra.
  String? get api => switch (this) {
    ResultadoFiltro.todos => null,
    ResultadoFiltro.permitido => 'permitido',
    ResultadoFiltro.rechazado => 'rechazado',
  };
}

/// En qué formato se baja una página. La API solo entrega CSV: el PDF y el
/// Excel se arman en la app a partir de esas mismas filas (ver `tabla_*.dart`).
enum FormatoDeDescarga {
  csv('csv', 'text/csv'),
  pdf('pdf', 'application/pdf'),
  xlsx(
    'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  new(this.extension, this.mimeType);

  /// La extensión del archivo, sin punto.
  final String extension;

  /// El tipo MIME que se pasa al menú de compartir o a la descarga.
  final String mimeType;
}

/// Filas por página: el máximo que acepta la API (`FILAS_POR_PAGINA_MAXIMAS`),
/// para que el tope de filas pese lo menos posible.
const porPaginaDeExportacion = 1000;

/// Los filtros de la exportación. `desde` y `hasta` son días de Bolivia, cada
/// uno guardado como el instante de su medianoche (ver [instanteDeDia]). Los
/// filtros de fecha solo valen para las lecturas; con otro recurso no se
/// mandan.
@immutable
class FiltrosDeExportacion {
  const new({this.resultado = ResultadoFiltro.todos, this.desde, this.hasta});

  final ResultadoFiltro resultado;

  /// Primer día incluido; `null` = sin límite.
  final DateTime? desde;

  /// Último día incluido; `null` = sin límite.
  final DateTime? hasta;

  FiltrosDeExportacion conResultado(ResultadoFiltro valor) =>
      FiltrosDeExportacion(resultado: valor, desde: desde, hasta: hasta);

  FiltrosDeExportacion conDesde(DateTime? dia) =>
      FiltrosDeExportacion(resultado: resultado, desde: dia, hasta: hasta);

  FiltrosDeExportacion conHasta(DateTime? dia) =>
      FiltrosDeExportacion(resultado: resultado, desde: desde, hasta: dia);
}

/// El instante de la medianoche de un día de Bolivia. La API usa
/// `[desde, hasta)` con instantes, así que un día entero va de su medianoche a
/// la del día siguiente.
DateTime instanteDeDia(DateTime dia) =>
    instanteDesdeBolivia(dia.year, dia.month, dia.day);

/// Que el rango no esté al revés. Un extremo vacío es un rango abierto y
/// siempre vale.
bool rangoValido(FiltrosDeExportacion filtros) {
  final desde = filtros.desde;
  final hasta = filtros.hasta;
  if (desde == null || hasta == null) return true;
  return !desde.isAfter(hasta);
}

/// El inicio del rango que se manda a la API (`desde`), o `null`.
DateTime? inicioDelRango(FiltrosDeExportacion filtros) => filtros.desde;

/// El fin del rango que se manda a la API (`hasta`): la medianoche del día
/// siguiente al último día incluido, contada en el calendario de Bolivia (que
/// no tiene horario de verano).
DateTime? finDelRango(FiltrosDeExportacion filtros) {
  final hasta = filtros.hasta;
  if (hasta == null) return null;
  final dia = horaBolivia(hasta);
  return instanteDesdeBolivia(dia.year, dia.month, dia.day + 1);
}

/// Lo que la API cuenta de una página en sus cabeceras `X-*`. `total` ya viene
/// con el tope aplicado.
@immutable
class ResumenDePagina {
  const new({
    required this.pagina,
    required this.porPagina,
    required this.total,
    required this.filas,
    required this.hayMas,
    required this.truncado,
  });

  final int pagina;
  final int porPagina;
  final int total;

  /// Filas de datos de esta página (sin el encabezado).
  final int filas;

  /// `true` si falta otra página.
  final bool hayMas;

  /// `true` si hay más datos que el tope y el resto no se exporta.
  final bool truncado;

  /// Cuántas páginas hay en total (al menos una).
  int get paginas => paginasDe(total, porPagina);
}

/// Una página lista para bajar: el CSV (solo en memoria mientras se comparte) y
/// su resumen.
@immutable
class PaginaDeExportacion {
  const new({required this.csv, required this.resumen});

  final Uint8List csv;
  final ResumenDePagina resumen;
}

/// Cuántas páginas hacen falta para el total. Una exportación vacía tiene una.
int paginasDe(int total, int porPagina) {
  if (total <= 0) return 1;
  return (total + porPagina - 1) ~/ porPagina;
}

/// La página que se pide ahora: la que sigue a la última bajada si hay más; si
/// no, vuelve a la primera.
int paginaSiguiente(ResumenDePagina? ultimo) =>
    ultimo != null && ultimo.hayMas ? ultimo.pagina + 1 : 1;

/// Nombre del archivo: el recurso, el código de la cuenta y la página, como
/// `lecturas-agr-p2.xlsx`. El código viene de la API: se limita a letras,
/// cifras, guion y guion bajo para que el nombre sea siempre predecible.
String nombreDeArchivo(
  RecursoExportable recurso,
  String codigoCuenta,
  int pagina,
  FormatoDeDescarga formato,
) {
  final codigo = codigoCuenta.toLowerCase().replaceAll(
    RegExp('[^a-z0-9_-]'),
    '',
  );
  final base = codigo.isEmpty ? 'cuenta' : codigo;
  return '${recurso.api}-$base-p$pagina.${formato.extension}';
}

/// La marca de orden de bytes de UTF-8. Excel lee las tildes y las eñes de un
/// CSV solo si el archivo empieza con ella; sin esto, al abrirlo con doble clic
/// se rompen.
const _marcaDeOrdenDeBytes = [0xEF, 0xBB, 0xBF];

/// El CSV con la marca de orden de bytes delante, para que Excel lo abra bien.
Uint8List conBomDeExcel(Uint8List csv) =>
    Uint8List.fromList([..._marcaDeOrdenDeBytes, ...csv]);
