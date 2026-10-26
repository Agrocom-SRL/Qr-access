import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/estado_qr_vista.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/tiempo_restante.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/vencimiento_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:flutter/material.dart';

/// Un QR en el listado (handoff C07) y en "Vigentes hoy" (C04a): etiqueta,
/// puertas, badge y las horas en mono. Anular es la única acción, y solo si
/// el QR sigue vigente.
class TarjetaQr extends StatelessWidget {
  const new({
    required this.qr,
    required this.ahora,
    this.anulando = false,
    this.alAnular,
    this.alVer,
    this.soloEnOtroDispositivo = false,
    this.compacta = false,
    super.key,
  });

  final QrAcceso qr;
  final DateTime ahora;
  final bool anulando;

  /// `null` si el usuario no tiene el permiso de anular: no se muestra el
  /// botón.
  final VoidCallback? alAnular;

  /// Abre el QR para mostrarlo. `null` si el texto no está en este
  /// dispositivo.
  final VoidCallback? alVer;

  /// El QR sigue vigente pero se generó en otro dispositivo: se avisa en lugar
  /// de ofrecer "Ver QR".
  final bool soloEnOtroDispositivo;

  /// Versión del tablero: sin horas de generación ni acción.
  final bool compacta;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final estiloMono = tokens.tipografia.mono(
      tokens.tipografia.t14,
      color: tokens.colores.textoSecundario,
    );
    return TarjetaFila(
      titulo: qr.etiqueta ?? l10n.qrSinEtiqueta,
      inicio: const CajaIcono(icono: Icons.qr_code_2),
      subtituloWidget: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            qr.nombresDePuertas,
            style: textos.bodyMedium?.copyWith(
              color: tokens.colores.textoSecundario,
            ),
          ),
          if (!compacta) ...[
            SizedBox(height: tokens.espacio.xs),
            Text(textoHorasDeQr(l10n, qr, ahora), style: estiloMono),
          ],
        ],
      ),
      fin: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          AccesoBadge(
            texto: textoEstadoQr(l10n, qr.estado),
            tono: tonoEstadoQr(qr.estado),
          ),
          if (compacta) ...[
            SizedBox(height: tokens.espacio.xs),
            Text(
              l10n.qrVenceCorto(textoHoraCorta(l10n, qr.venceAt, ahora)),
              style: estiloMono,
            ),
          ],
        ],
      ),
      pie: !compacta && qr.estado == EstadoQr.vigente
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    // Abajo a la izquierda: cuánto tiempo de validez le queda.
                    Expanded(
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: TiempoRestante(venceAt: qr.venceAt),
                      ),
                    ),
                    if (alVer != null)
                      AccesoBoton(
                        texto: l10n.qrVerQr,
                        icono: Icons.qr_code_2,
                        variante: VarianteBoton.texto,
                        onPressed: alVer,
                      ),
                    if (qr.puedeAnularse && alAnular != null)
                      // Anular es una baja: va en peligro (handoff C07).
                      AccesoBoton(
                        texto: l10n.qrAnular,
                        icono: Icons.block,
                        variante: VarianteBoton.peligroTexto,
                        cargando: anulando,
                        onPressed: alAnular,
                      ),
                  ],
                ),
                if (soloEnOtroDispositivo)
                  Text(
                    l10n.qrSoloEnOtroDispositivo,
                    style: textos.bodySmall?.copyWith(
                      color: tokens.colores.textoSecundario,
                    ),
                  ),
              ],
            )
          : null,
    );
  }
}

/// "Hoy 09:12 → vence 23:59", o la hora de uso o anulación según el estado.
String textoHorasDeQr(AppLocalizations l10n, QrAcceso qr, DateTime ahora) {
  final generado = textoHoraCorta(l10n, qr.creadoAt, ahora);
  return switch (qr.estado) {
    EstadoQr.vigente || EstadoQr.vencido => l10n.qrGeneradoYVence(
      generado,
      textoHoraCorta(l10n, qr.venceAt, ahora),
    ),
    EstadoQr.usado => l10n.qrUsadoEl(
      textoHoraCorta(l10n, qr.usadoAt ?? qr.venceAt, ahora),
    ),
    EstadoQr.anulado => l10n.qrAnuladoEl(
      textoHoraCorta(l10n, qr.anuladoAt ?? qr.venceAt, ahora),
    ),
  };
}
