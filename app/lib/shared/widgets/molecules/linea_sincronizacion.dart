import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sincronizacion/estado_sincronizacion.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Minutos por hora y horas por día: los límites entre un tramo de texto y
/// otro. Son cuenta del tiempo, no medidas de pantalla: no van en tokens.
const _minutosPorHora = 60;
const _horasPorDia = 24;

/// Línea discreta de sincronización, sobre la lista o junto a su título:
/// "Actualizando…", "Actualizado hace 2 min" o "Sin conexión, mostrando lo
/// último guardado". Solo pinta: el estado y la hora llegan de quien
/// sincroniza (`ControladorSincronizacion`), y [ahora] del reloj inyectado.
class LineaSincronizacion extends StatelessWidget {
  const new({required this.estado, required this.ahora, super.key});

  final EstadoSincronizacion estado;

  /// Instante actual, para decir cuánto hace de la última actualización.
  final DateTime ahora;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final ultima = estado.ultimaActualizacion;
    if (!estado.actualizando && !estado.sinConexion && ultima == null) {
      return const SizedBox.shrink();
    }

    // Prioridad: lo que está pasando ahora, luego la falta de red y, al final,
    // la hora de la última respuesta viva.
    final (texto, hijo) = estado.actualizando
        ? (
            l10n.comunSincronizacionActualizando,
            SizedBox(
              width: tokens.tamano.spinner,
              height: tokens.tamano.spinner,
              child: CircularProgressIndicator(
                strokeWidth: tokens.tamano.bordeFoco,
                color: colores.primario,
              ),
            ),
          )
        : estado.sinConexion
        ? (
            l10n.comunSincronizacionSinConexion,
            Icon(
              Icons.cloud_off_outlined,
              size: tokens.tamano.icono,
              color: colores.advertencia,
            ),
          )
        : (
            textoUltimaActualizacion(l10n, ultima!, ahora),
            Icon(
              Icons.check_circle_outline,
              size: tokens.tamano.icono,
              color: colores.textoSecundario,
            ),
          );

    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: tokens.espacio.l,
          vertical: tokens.espacio.xs,
        ),
        child: Row(
          children: [
            hijo,
            SizedBox(width: tokens.espacio.s),
            Expanded(
              child: Text(
                texto,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: estado.sinConexion && !estado.actualizando
                      ? colores.advertencia
                      : colores.textoSecundario,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Actualizado hace un momento", "hace 2 min", "hace 3 h" o la fecha si pasó
/// más de un día. Un instante futuro (reloj desfasado) cuenta como "hace un
/// momento".
String textoUltimaActualizacion(
  AppLocalizations l10n,
  DateTime instante,
  DateTime ahora,
) {
  final minutos = ahora.difference(instante).inMinutes;
  if (minutos < 1) return l10n.comunSincronizacionMomento;
  if (minutos < _minutosPorHora) {
    return l10n.comunSincronizacionMinutos(minutos);
  }
  final horas = minutos ~/ _minutosPorHora;
  if (horas < _horasPorDia) return l10n.comunSincronizacionHoras(horas);
  return l10n.comunSincronizacionFecha(formatearFechaHora(instante));
}
