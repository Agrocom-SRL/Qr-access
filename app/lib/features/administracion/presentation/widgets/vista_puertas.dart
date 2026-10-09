import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Puertas con su lector y su estado (handoff C10a/E10a, HU-09): tarjetas
/// agrupadas por sitio en compacto, tabla con "última señal" en expandido.
class VistaPuertas extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final puertas = ref.watch(puertasDisponiblesProvider);
    final ahora = ref.read(relojProvider)();
    final estado = estadoDesdeAsync(
      puertas.whenData(
        (lista) => Pagina(
          datos: lista,
          pagina: 1,
          porPagina: lista.isEmpty ? 1 : lista.length,
          total: lista.length,
        ),
      ),
      ahora: ahora,
    );
    return ListadoPaginado<Puerta>(
      estado: estado,
      tituloDeError: l10n.puertasErrorCargar,
      alReintentar: () => ref.invalidate(puertasDisponiblesProvider),
      alCambiarPagina: (_) {},
      vacio: EstadoVacio(
        icono: Icons.door_front_door_outlined,
        titulo: l10n.puertasSinPuertas,
        ayuda: l10n.puertasSinPuertasAyuda,
      ),
      // "SEDE DEMO · 2": el sitio con cuántas puertas tiene (C10a).
      encabezadoDe: (puerta, anterior) =>
          anterior == null || anterior.sitioId != puerta.sitioId
          ? l10n.puertasSitioConCantidad(
              puerta.sitioNombre,
              (puertas.value ?? const [])
                  .where((p) => p.sitioId == puerta.sitioId)
                  .length,
            )
          : null,
      tarjeta: (context, puerta) => TarjetaPuerta(puerta: puerta),
      columnas: [
        ColumnaListado(
          titulo: l10n.puertasColumnaPuerta,
          celda: (context, puerta) => Text(
            puerta.nombre,
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ),
        ColumnaListado(
          titulo: l10n.eventosColumnaSitio,
          celda: (context, puerta) => Text(
            puerta.sitioNombre,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: tokens.colores.textoSecundario),
          ),
        ),
        ColumnaListado(
          titulo: l10n.puertasColumnaDispositivo,
          celda: (context, puerta) => Text(
            puerta.dispositivo?.nombre ?? l10n.puertaSinLector,
            style: tokens.tipografia.mono(
              tokens.tipografia.t14,
              color: tokens.colores.texto,
            ),
          ),
        ),
        ColumnaListado(
          titulo: l10n.comunEstado,
          celda: (context, puerta) => BadgeDePuerta(puerta: puerta),
        ),
        ColumnaListado(
          titulo: l10n.puertasColumnaUltimaSenal,
          celda: (context, puerta) => Text(
            textoUltimaSenal(l10n, puerta, ahora),
            style: tokens.tipografia.mono(
              tokens.tipografia.t14,
              color: tokens.colores.textoSecundario,
            ),
          ),
        ),
      ],
    );
  }
}

/// Una puerta en tarjeta: ícono según conexión, nombre, lector y badge.
class TarjetaPuerta extends StatelessWidget {
  const new({required this.puerta, super.key});

  final Puerta puerta;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return TarjetaFila(
      titulo: puerta.nombre,
      inicio: CajaIcono(
        icono: puerta.sinConexion
            ? Icons.wifi_off
            : Icons.door_front_door_outlined,
        tono: puerta.sinConexion ? TonoCaja.peligro : TonoCaja.primario,
      ),
      subtituloWidget: Text(
        puerta.dispositivo?.nombre ?? l10n.puertaSinLector,
        style: tokens.tipografia.mono(
          tokens.tipografia.t14,
          color: tokens.colores.textoSecundario,
        ),
      ),
      fin: BadgeDePuerta(puerta: puerta),
    );
  }
}

/// "En línea" en primario o "Sin conexión" en peligro (handoff).
class BadgeDePuerta extends StatelessWidget {
  const new({required this.puerta, super.key});

  final Puerta puerta;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return puerta.sinConexion
        ? AccesoBadge(texto: l10n.puertaSinConexion, tono: TonoAcceso.peligro)
        : AccesoBadge(texto: l10n.puertaEnLinea, tono: TonoAcceso.primario);
  }
}

/// "hace 8 s", "hace 34 min", "hace 2 h" o "nunca".
String textoUltimaSenal(AppLocalizations l10n, Puerta puerta, DateTime ahora) {
  final ultimo = puerta.dispositivo?.ultimoLatidoAt;
  if (ultimo == null) return l10n.puertaNuncaReporto;
  final hace = ahora.difference(ultimo);
  if (hace.inSeconds < 60) return l10n.comunHaceSegundos(hace.inSeconds);
  if (hace.inMinutes < 60) return l10n.comunHaceMinutos(hace.inMinutes);
  if (hace.inHours < 24) return l10n.comunHaceHoras(hace.inHours);
  return formatearFechaHora(ultimo);
}
