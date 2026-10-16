import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';

/// "Vence hoy a las 23:59" o "Vence el 10/10/2026 08:00", según el día.
String textoVence(AppLocalizations l10n, DateTime venceAt, DateTime ahora) =>
    mismoDiaLocal(venceAt, ahora)
    ? l10n.qrVenceHoyALas(formatearHora(venceAt))
    : l10n.qrVenceEl(formatearFechaHora(venceAt));

/// "Hoy 23:59" o "10/10 08:00": la forma corta de las tarjetas y tablas.
String textoHoraCorta(AppLocalizations l10n, DateTime fecha, DateTime ahora) =>
    mismoDiaLocal(fecha, ahora)
    ? l10n.comunHoyALas(formatearHora(fecha))
    : formatearFechaHora(fecha);
