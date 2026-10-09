import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Los QR vigentes del usuario para "Vigentes hoy" (C04a): los primeros.
final FutureProvider<Pagina<QrAcceso>> qrVigentesProvider =
    FutureProvider.autoDispose<Pagina<QrAcceso>>(
      (ref) => ref
          .watch(qrAccesosRepositorioProvider)
          .listar(
            estado: EstadoQr.vigente,
            pagina: 1,
            porPagina: const Tamanos().filasDelTablero,
          ),
    );

/// Lo que pinta el tablero del administrador (C04b/E04b).
@immutable
class Tablero {
  const new({
    required this.resumenDeHoy,
    required this.puertas,
    required this.ultimosEventos,
    required this.actualizadoAt,
  });

  final ResumenEventos resumenDeHoy;
  final List<Puerta> puertas;
  final List<EventoAcceso> ultimosEventos;
  final DateTime actualizadoAt;

  List<Puerta> get puertasSinConexion =>
      puertas.where((p) => p.sinConexion).toList();
}

/// Indicadores del día, estado de las puertas y últimos eventos. Se refresca
/// con `ref.invalidate` (cada 30 s y con pull-to-refresh, handoff).
final FutureProvider<Tablero> tableroProvider =
    FutureProvider.autoDispose<Tablero>((ref) async {
      final ahora = ref.read(relojProvider)();
      final inicioDelDia = diaLocal(ahora).toUtc();
      final eventos = ref.watch(eventosRepositorioProvider);
      final (resumen, puertas, ultimos) = await (
        eventos.resumir(FiltroEventos(desde: inicioDelDia)),
        ref.watch(puertasDisponiblesProvider.future),
        eventos.listar(
          filtro: const FiltroEventos(),
          pagina: 1,
          porPagina: const Tamanos().filasDelTablero,
        ),
      ).wait;
      return Tablero(
        resumenDeHoy: resumen,
        puertas: puertas,
        ultimosEventos: ultimos.datos,
        actualizadoAt: ahora,
      );
    });
