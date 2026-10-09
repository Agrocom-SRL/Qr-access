import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/mostrar_qr_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/visor_qr.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Muestra el QR recién emitido y lo comparte. El token vive solo aquí: al
/// salir, no se puede volver a ver (ADR 0008).
class MostrarQrPagina extends ConsumerWidget {
  const new({required this.qr, super.key});

  final QrEmitido qr;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final texto = Theme.of(context).textTheme;
    final compartiendo = ref.watch(mostrarQrControladorProvider);
    final vence = formatearFechaHora(qr.venceAt);
    final puertas = qr.puertas.map((puerta) => puerta.nombre).join(', ');

    return PlantillaPantalla(
      titulo: l10n.qrMostrarTitulo,
      esFormulario: true,
      child: SingleChildScrollView(
        padding: EdgeInsets.all(tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: VisorQr(texto: qr.texto)),
            SizedBox(height: tokens.espacio.l),
            Text(
              qr.etiqueta ?? l10n.qrSinEtiqueta,
              style: texto.titleMedium,
              textAlign: TextAlign.center,
            ),
            SizedBox(height: tokens.espacio.xs),
            Text(puertas, style: texto.bodyMedium, textAlign: TextAlign.center),
            SizedBox(height: tokens.espacio.xs),
            Text(
              l10n.qrVenceEl(vence),
              style: texto.titleSmall,
              textAlign: TextAlign.center,
            ),
            SizedBox(height: tokens.espacio.l),
            Text(
              l10n.qrMostrarAviso,
              style: texto.bodySmall?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: tokens.espacio.xl),
            AccesoBoton(
              texto: l10n.qrCompartir,
              icono: Icons.share,
              cargando: compartiendo,
              onPressed: () => ref
                  .read(mostrarQrControladorProvider.notifier)
                  .compartir(
                    qr: qr,
                    texto: l10n.qrCompartirTexto(puertas, vence),
                    tokens: tokens,
                  ),
            ),
            SizedBox(height: tokens.espacio.s),
            AccesoBoton(
              texto: l10n.qrListo,
              variante: VarianteBoton.texto,
              onPressed: () => context.go(Rutas.qrMios),
            ),
          ],
        ),
      ),
    );
  }
}
