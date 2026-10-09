import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/features/eventos/presentation/evento_vista.dart';
import 'package:agrocom_acceso/features/eventos/presentation/eventos_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_error.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Bitácora de intentos de acceso de la cuenta (HU-15), en tarjetas paginadas.
class EventosPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final eventos = ref.watch(eventosProvider);

    return PlantillaPantalla(
      titulo: l10n.eventosTitulo,
      child: eventos.when(
        loading: () => const AccesoCargando(),
        error: (error, _) => EstadoError(
          mensaje: textoDeError(l10n, error),
          alReintentar: () => ref.invalidate(eventosProvider),
        ),
        data: (pagina) => pagina.datos.isEmpty
            ? EstadoVacio(
                icono: Icons.history,
                titulo: l10n.eventosSinResultados,
                ayuda: l10n.eventosSinResultadosAyuda,
              )
            : ListadoPaginado<EventoAcceso>(
                pagina: pagina,
                alCambiarPagina: (pagina) =>
                    ref.read(paginaEventosProvider.notifier).pagina = pagina,
                itemBuilder: (context, evento) =>
                    _TarjetaEvento(evento: evento),
              ),
      ),
    );
  }
}

class _TarjetaEvento extends StatelessWidget {
  const new({required this.evento});

  final EventoAcceso evento;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final texto = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    evento.puertaNombre,
                    style: texto.titleMedium,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                AccesoBadge(
                  texto: textoResultadoEvento(l10n, evento.resultado),
                  tono: tonoResultadoEvento(evento.resultado),
                ),
              ],
            ),
            SizedBox(height: tokens.espacio.xs),
            Text(
              textoMotivoEvento(l10n, evento.motivoCode),
              style: texto.bodyMedium,
            ),
            SizedBox(height: tokens.espacio.xs),
            Text(
              formatearFechaHora(evento.ocurridoAt),
              style: texto.bodySmall?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
