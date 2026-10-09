import 'package:intl/intl.dart';

final _fechaHora = DateFormat('dd/MM/yyyy HH:mm');

/// Muestra una fecha de la API (UTC) en la hora local del dispositivo
/// (invariante 7: se guarda en UTC; se muestra en la hora del usuario).
/// El formato es numérico, así que no depende de datos de idioma cargados.
String formatearFechaHora(DateTime fechaUtc) =>
    _fechaHora.format(fechaUtc.toLocal());
