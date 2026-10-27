import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/data/fuentes_pdf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/domain/pdf/tabla_pdf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_xlsx.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Lo que la pantalla muestra de la exportación. El CSV NO vive aquí: cada
/// página se pasa al menú de compartir y se suelta; el estado solo guarda el
/// resumen de la última página bajada.
@immutable
class EstadoExportacion {
  const new({
    required this.recurso,
    required this.filtros,
    this.ultimo,
    this.descargando = false,
    this.error,
  });

  final RecursoExportable recurso;
  final FiltrosDeExportacion filtros;

  /// La última página bajada con este recurso y estos filtros; `null` si
  /// todavía no se bajó ninguna.
  final ResumenDePagina? ultimo;
  final bool descargando;

  /// Lo que falló al bajar la última página, para mostrarlo traducido.
  final ErrorApi? error;
}

/// Baja las páginas de la exportación de a una, a pedido de quien exporta.
/// Cambiar el recurso o un filtro empieza de nuevo (la página 1).
class ExportacionControlador extends Notifier<EstadoExportacion> {
  @override
  EstadoExportacion build() => const EstadoExportacion(
    recurso: RecursoExportable.usuarios,
    filtros: FiltrosDeExportacion(),
  );

  void elegirRecurso(RecursoExportable recurso) =>
      state = EstadoExportacion(recurso: recurso, filtros: state.filtros);

  void elegirResultado(ResultadoFiltro resultado) =>
      _cambiarFiltros(state.filtros.conResultado(resultado));

  void elegirDesde(DateTime? dia) =>
      _cambiarFiltros(state.filtros.conDesde(dia));

  void elegirHasta(DateTime? dia) =>
      _cambiarFiltros(state.filtros.conHasta(dia));

  void _cambiarFiltros(FiltrosDeExportacion filtros) =>
      state = EstadoExportacion(recurso: state.recurso, filtros: filtros);

  /// Baja la página que sigue, la convierte al [formato] pedido, la pasa al
  /// menú de compartir y guarda su resumen. [textosDe] arma lo que va escrito
  /// en el PDF y el Excel (título, fecha, parte) a partir del resumen de la
  /// página.
  /// Si la persona cierra el menú, la página no cuenta como bajada y la próxima
  /// vez se pide la misma. Un rango al revés no se manda.
  Future<void> descargarSiguiente({
    required TextosDeDocumento Function(ResumenDePagina resumen) textosDe,
    FormatoDeDescarga formato = FormatoDeDescarga.csv,
  }) async {
    final recurso = state.recurso;
    final filtros = state.filtros;
    if (state.descargando || !rangoValido(filtros)) return;
    final pagina = paginaSiguiente(state.ultimo);
    state = _con(descargando: true);
    try {
      final entregada = await ref
          .read(exportacionRepositorioProvider)
          .pagina(recurso: recurso, pagina: pagina, filtros: filtros);
      final resumen = entregada.resumen;
      // Sin filas no hay archivo que compartir; con filas, solo cuenta si
      // salió.
      final cuenta =
          resumen.total == 0 ||
          await _compartir(recurso, formato, entregada, textosDe(resumen)) !=
              ResultadoCompartir.cancelado;
      state = _con(ultimo: cuenta ? resumen : null);
    } on ErrorApi catch (error) {
      state = _con(error: error);
    } finally {
      // Cualquier otro fallo (p. ej. del menú de compartir) no deja el botón
      // bloqueado en "descargando".
      if (state.descargando) state = _con();
    }
  }

  /// Con filas, la página va al menú de compartir; sin filas no hay nada que
  /// bajar, y el resumen basta para decirlo.
  Future<ResultadoCompartir> _compartir(
    RecursoExportable recurso,
    FormatoDeDescarga formato,
    PaginaDeExportacion entregada,
    TextosDeDocumento textos,
  ) async {
    final bytes = await _archivo(formato, entregada.csv, textos);
    final resultado = await ref
        .read(compartirArchivoProvider)
        .compartir(
          bytes: bytes,
          nombreArchivo: nombreDeArchivo(
            recurso,
            _codigoDeCuenta(),
            entregada.resumen.pagina,
            formato,
          ),
          mimeType: formato.mimeType,
        );
    return resultado;
  }

  /// El archivo de la página en el formato pedido. El CSV sale tal cual (con
  /// su BOM); el Excel y el PDF se arman con las mismas filas.
  Future<Uint8List> _archivo(
    FormatoDeDescarga formato,
    Uint8List csv,
    TextosDeDocumento textos,
  ) async {
    switch (formato) {
      case FormatoDeDescarga.csv:
        return conBomDeExcel(csv);
      case FormatoDeDescarga.xlsx:
        return tablaAXlsx(leerCsv(csv), nombreHoja: textos.titulo);
      case FormatoDeDescarga.pdf:
        final fuentes = await ref.read(fuentesPdfProvider.future);
        return tablaAPdf(leerCsv(csv), textos, fuentes);
    }
  }

  String _codigoDeCuenta() {
    final sesion = ref.read(sesionControladorProvider);
    return sesion is SesionAutenticada ? sesion.cuenta.codigo : '';
  }

  /// El estado con los campos que cambian: el recurso y los filtros se
  /// conservan siempre.
  EstadoExportacion _con({
    bool descargando = false,
    ResumenDePagina? ultimo,
    ErrorApi? error,
  }) => EstadoExportacion(
    recurso: state.recurso,
    filtros: state.filtros,
    ultimo: ultimo ?? state.ultimo,
    descargando: descargando,
    error: error,
  );
}

final NotifierProvider<ExportacionControlador, EstadoExportacion>
exportacionControladorProvider =
    NotifierProvider.autoDispose<ExportacionControlador, EstadoExportacion>(
      ExportacionControlador.new,
    );
