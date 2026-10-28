import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';
import 'package:intl/intl.dart';

/// Lo que va escrito alrededor de la tabla en el PDF y el Excel, en el idioma
/// de la app. La fecha sale en la zona del teléfono de quien baja el archivo:
/// dice cuándo lo bajó, no cuándo se generó en el servidor.
TextosDeDocumento textosDeDocumento({
  required AppLocalizations l10n,
  required RecursoExportable recurso,
  required DateTime instante,
  required ResumenDePagina resumen,
}) {
  final titulo = switch (recurso) {
    RecursoExportable.usuarios => l10n.exportacionRecursoUsuarios,
    RecursoExportable.puertas => l10n.exportacionRecursoPuertas,
    RecursoExportable.lecturas => l10n.exportacionRecursoLecturas,
  };
  return TextosDeDocumento(
    titulo: titulo,
    generado: l10n.exportacionDocGenerado(_fechaLocal(instante)),
    parte: resumen.paginas > 1
        ? l10n.exportacionDocParte(resumen.pagina, resumen.paginas)
        : null,
    paginaDe: l10n.exportacionDocPagina,
  );
}

/// La fecha y hora en la zona del teléfono, como "27/10/2026 10:05".
String _fechaLocal(DateTime instante) =>
    DateFormat('dd/MM/yyyy HH:mm').format(instante.toLocal());
