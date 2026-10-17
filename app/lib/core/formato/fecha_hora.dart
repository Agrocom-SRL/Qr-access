import 'package:intl/intl.dart';

final _fechaHora = DateFormat('dd/MM/yyyy HH:mm');
final _fecha = DateFormat('dd/MM/yyyy');
final _hora = DateFormat('HH:mm');
final _horaConSegundos = DateFormat('HH:mm:ss');

/// Bolivia está en UTC-4 todo el año (no tiene horario de verano), así que un
/// desfase fijo equivale a `America/La_Paz` sin cargar una base de zonas.
const _horasDesfaseBolivia = 4;
const _desfaseBolivia = Duration(hours: _horasDesfaseBolivia);

/// Convierte un instante a la hora de pared de Bolivia, sin importar la zona
/// del dispositivo. El `DateTime` devuelto está marcado como UTC solo para que
/// sus campos (`hour`, `day`…) se lean tal cual; no es un instante UTC.
DateTime horaBolivia(DateTime fecha) => fecha.toUtc().subtract(_desfaseBolivia);

/// Inverso de [horaBolivia]: el instante (UTC) que corresponde a esa hora de
/// pared en Bolivia.
DateTime instanteDesdeBolivia(
  int year,
  int month,
  int day, [
  int hour = 0,
  int minute = 0,
]) => DateTime.utc(year, month, day, hour, minute).add(_desfaseBolivia);

/// Muestra una fecha de la API (UTC) en la hora de Bolivia, igual en todos los
/// dispositivos (invariante 7: se guarda en UTC y se muestra en hora de
/// Bolivia).
/// El formato es numérico, así que no depende de datos de idioma cargados.
String formatearFechaHora(DateTime fechaUtc) =>
    _fechaHora.format(horaBolivia(fechaUtc));

String formatearFecha(DateTime fechaUtc) =>
    _fecha.format(horaBolivia(fechaUtc));

String formatearHora(DateTime fechaUtc) => _hora.format(horaBolivia(fechaUtc));

String formatearHoraConSegundos(DateTime fechaUtc) =>
    _horaConSegundos.format(horaBolivia(fechaUtc));

/// `true` si las dos fechas caen el mismo día en la hora de Bolivia.
bool mismoDiaLocal(DateTime a, DateTime b) {
  final (la, lb) = (horaBolivia(a), horaBolivia(b));
  return la.year == lb.year && la.month == lb.month && la.day == lb.day;
}

/// Día en Bolivia de `fecha`, a medianoche (para agrupar por día).
DateTime diaLocal(DateTime fecha) {
  final local = horaBolivia(fecha);
  return DateTime.utc(local.year, local.month, local.day);
}

/// Cuántos días faltan desde `ahora` hasta `hasta` (0 si ya pasó).
int diasRestantes(DateTime hasta, DateTime ahora) {
  final dias = hasta.difference(ahora).inDays;
  return dias < 0 ? 0 : dias;
}
