import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/qr/imagen_qr.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mostrar_qr_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/vencimiento_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/visor_qr.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla_completa.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Muestra el QR recién emitido y lo comparte (handoff C06/E06). El token
/// vive solo aquí: al salir, no se puede volver a ver (ADR 0008). Cerrar sin
/// compartir pide confirmación (S05).
class MostrarQrPagina extends ConsumerWidget {
  const new({required this.qr, super.key});

  final QrEmitido qr;

  Future<void> _cerrar(BuildContext context, WidgetRef ref) async {
    final estado = ref.read(mostrarQrControladorProvider);
    final l10n = context.l10n;
    if (!estado.compartido && !estado.descargado) {
      final vence = formatearHoraDe(qr.venceAt);
      final cerrar = await ConfirmarDialogo.mostrar(
        context,
        titulo: l10n.qrCerrarSinCompartirTitulo,
        mensaje: l10n.qrCerrarSinCompartirMensaje(vence),
        textoConfirmar: l10n.qrCerrarIgual,
        textoCancelar: l10n.qrCompartir,
        variante: VarianteBoton.peligroTonal,
      );
      if (!cerrar) return;
    }
    if (context.mounted) context.go(Rutas.qrMios);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final texto = Theme.of(context).textTheme;
    final estado = ref.watch(mostrarQrControladorProvider);
    final ahora = ref.read(relojProvider)();
    final vence = textoVence(l10n, qr.venceAt, ahora);
    final titulo = qr.etiqueta ?? l10n.qrSinEtiqueta;
    final puertas = qr.nombresDePuertas;

    return PlantillaPantallaCompleta(
      titulo: l10n.qrMostrarTitulo,
      alCerrar: () => _cerrar(context, ref),
      pie: AccesoBoton(
        texto: l10n.qrCompartir,
        textoCargando: l10n.qrPreparando,
        icono: Icons.share_outlined,
        cargando: estado.compartiendo,
        expandido: true,
        onPressed: () => ref
            .read(mostrarQrControladorProvider.notifier)
            .compartir(
              qr: qr,
              textos: TextosDeImagenQr(
                titulo: titulo,
                puertas: puertas,
                vencimiento: vence,
              ),
              mensaje: l10n.qrCompartirTexto(puertas, vence),
              tokens: tokens,
            ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(child: VisorQr(texto: qr.texto)),
          SizedBox(height: tokens.espacio.xl),
          Text(
            titulo,
            style: texto.headlineMedium,
            textAlign: TextAlign.center,
          ),
          SizedBox(height: tokens.espacio.xs),
          Text(
            puertas,
            style: texto.bodyLarge?.copyWith(
              color: tokens.colores.textoSecundario,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: tokens.espacio.s),
          Text(vence, style: texto.titleMedium, textAlign: TextAlign.center),
          SizedBox(height: tokens.espacio.xl),
          if (estado.fallo)
            AccesoAviso(tono: TonoAviso.peligro, texto: l10n.qrCompartirFallo)
          else if (estado.descargado)
            AccesoAviso(tono: TonoAviso.primario, texto: l10n.qrDescargado)
          else
            AccesoAviso(
              icono: Icons.visibility_off_outlined,
              texto: l10n.qrMostrarAviso,
            ),
        ],
      ),
    );
  }
}

/// "23:59" de la hora de vencimiento, para el diálogo de cierre.
String formatearHoraDe(DateTime venceAt) {
  final local = venceAt.toLocal();
  final h = local.hour.toString().padLeft(2, '0');
  final m = local.minute.toString().padLeft(2, '0');
  return '$h:$m';
}
