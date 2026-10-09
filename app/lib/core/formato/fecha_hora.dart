import 'package:intl/intl.dart';

final _fechaHora = DateFormat('dd/MM/yyyy HH:mm');
final _fecha = DateFormat('dd/MM/yyyy');
final _hora = DateFormat('HH:mm');
final _horaConSegundos = DateFormat('HH:mm:ss');

/// Muestra una fecha de la API (UTC) en la hora local del dispositivo
/// (invariante 7: se guarda en UTC; se muestra en la hora del usuario).
/// El formato es numérico, así que no depende de datos de idioma cargados.
String formatearFechaHora(DateTime fechaUtc) =>
    _fechaHora.format(fechaUtc.toLocal());

String formatearFecha(DateTime fechaUtc) => _fecha.format(fechaUtc.toLocal());

String formatearHora(DateTime fechaUtc) => _hora.format(fechaUtc.toLocal());

String formatearHoraConSegundos(DateTime fechaUtc) =>
    _horaConSegundos.format(fechaUtc.toLocal());

/// `true` si las dos fechas caen el mismo día en la hora local.
bool mismoDiaLocal(DateTime a, DateTime b) {
  final (la, lb) = (a.toLocal(), b.toLocal());
  return la.year == lb.year && la.month == lb.month && la.day == lb.day;
}

/// Día local de `fecha`, a medianoche (para agrupar por día).
DateTime diaLocal(DateTime fecha) {
  final local = fecha.toLocal();
  return DateTime(local.year, local.month, local.day);
}

/// Cuántos días faltan desde `ahora` hasta `hasta` (0 si ya pasó).
int diasRestantes(DateTime hasta, DateTime ahora) {
  final dias = hasta.toLocal().difference(ahora.toLocal()).inDays;
  return dias < 0 ? 0 : dias;
}
