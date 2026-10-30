import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:agrocom_acceso/features/apertura_manual/presentation/abrir_puerta_controlador.dart';
import 'package:agrocom_acceso/features/apertura_manual/presentation/apertura_manual_providers.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_skeleton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// "Abrir puerta" (ADR 0035): la persona elige una de las puertas disponibles
/// y la abre sin QR. No pregunta ni dice entrada o salida: sin geovalla nadie
/// sabe hacia dónde va; solo se elige la puerta.
class AbrirPuertaPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final apertura = ref.watch(abrirPuertaProvider);
    final puertas = ref.watch(puertasAbriblesProvider);

    return PlantillaAdmin(
      destino: DestinoNav.inicio,
      titulo: l10n.abrirPuertaTitulo,
      rutaAtras: Rutas.inicio,
      salida: SalidaDeCabecera.cerrar,
      alSalir: () => context.go(Rutas.inicio),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (apertura.fase != FaseDeApertura.libre)
            _Progreso(apertura: apertura)
          else ...[
            AccesoAviso(
              tono: TonoAviso.informacion,
              texto: l10n.abrirPuertaAyuda,
            ),
            SizedBox(height: tokens.espacio.l),
            puertas.when(
              loading: () => const _PuertasCargando(),
              error: (error, _) => EstadoVacio.error(
                titulo: textoDeError(l10n, error),
                alReintentar: () => ref.invalidate(puertasAbriblesProvider),
              ),
              data: (lista) => _Puertas(puertas: lista),
            ),
          ],
        ],
      ),
    );
  }
}

/// Las tarjetas de las puertas mientras se piden: el mismo bloque que ocupará
/// cada una, para que la lista no salte al cargar.
class _PuertasCargando extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      children: [
        for (var i = 0; i < 3; i++)
          Padding(
            padding: EdgeInsets.only(bottom: tokens.espacio.m),
            child: AccesoTarjeta(
              child: AccesoSkeleton(alto: tokens.tamano.iconoCaja),
            ),
          ),
      ],
    );
  }
}

class _Puertas extends ConsumerWidget {
  const new({required this.puertas});

  final List<PuertaAbrible> puertas;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final disponibles = puertas.where((p) => p.disponible).toList();
    if (disponibles.isEmpty) {
      return EstadoVacio(
        titulo: l10n.abrirPuertaSinPuertas,
        ayuda: l10n.abrirPuertaSinPuertasDetalle,
        ilustracion: Multimedia.vacioPuertas,
      );
    }
    return Column(
      children: [
        for (final puerta in disponibles)
          Padding(
            padding: EdgeInsets.only(bottom: tokens.espacio.m),
            child: TarjetaFila(
              titulo: puerta.nombre,
              subtitulo: puerta.sitioNombre,
              inicio: const Icon(Icons.door_front_door_outlined),
              fin: puerta.enLinea
                  ? null
                  : AccesoBadge(
                      texto: l10n.abrirPuertaSinConexion,
                      tono: TonoAcceso.peligro,
                    ),
              pie: AccesoBoton(
                texto: l10n.abrirPuertaAccion,
                icono: Icons.lock_open,
                expandido: true,
                // Con la placa sin reportar la API respondería 409: se evita
                // el viaje y se deja ver por qué no se puede.
                onPressed: puerta.enLinea
                    ? () => ref.read(abrirPuertaProvider.notifier).abrir(puerta)
                    : null,
              ),
            ),
          ),
      ],
    );
  }
}

class _Progreso extends ConsumerWidget {
  const new({required this.apertura});

  final AperturaEstado apertura;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final nombre = apertura.puertaNombre ?? '';
    final (titulo, detalle, icono, tono) = switch (apertura.fase) {
      FaseDeApertura.enviando => (
        l10n.abrirPuertaEnviando,
        null,
        Icons.hourglass_top,
        TonoAviso.informacion,
      ),
      FaseDeApertura.esperando => (
        l10n.abrirPuertaEsperando(nombre),
        null,
        Icons.hourglass_top,
        TonoAviso.informacion,
      ),
      FaseDeApertura.abierta => (
        l10n.abrirPuertaAbierta(nombre),
        null,
        Icons.lock_open,
        TonoAviso.primario,
      ),
      FaseDeApertura.fallo || FaseDeApertura.libre => (
        l10n.abrirPuertaFallo(nombre),
        _detalleDeFallo(l10n, apertura),
        Icons.error_outline,
        TonoAviso.peligro,
      ),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: tokens.espacio.l),
        Icon(icono, size: tokens.tamano.iconoNav * 2),
        SizedBox(height: tokens.espacio.m),
        Text(titulo, textAlign: TextAlign.center, style: textos.titleLarge),
        SizedBox(height: tokens.espacio.l),
        if (detalle != null)
          AccesoAviso(tono: tono, texto: detalle, icono: icono),
        if (apertura.enCurso)
          Padding(
            padding: EdgeInsets.all(tokens.espacio.xl),
            child: const AccesoCargando(),
          )
        else ...[
          SizedBox(height: tokens.espacio.l),
          AccesoBoton(
            texto: l10n.abrirPuertaOtra,
            icono: Icons.door_front_door_outlined,
            expandido: true,
            variante: VarianteBoton.secundaria,
            onPressed: () {
              ref.read(abrirPuertaProvider.notifier).reiniciar();
              ref.invalidate(puertasAbriblesProvider);
            },
          ),
        ],
      ],
    );
  }
}

/// La causa de que no se abriera: el error de la API si la orden ni se creó,
/// o cómo terminó la orden si sí.
String _detalleDeFallo(AppLocalizations l10n, AperturaEstado apertura) {
  if (apertura.error != null) return textoDeError(l10n, apertura.error!);
  return switch (apertura.desenlace) {
    DesenlaceDeApertura.noAbrio => l10n.abrirPuertaFalloNoAbrio,
    _ => l10n.abrirPuertaFalloVencida,
  };
}
